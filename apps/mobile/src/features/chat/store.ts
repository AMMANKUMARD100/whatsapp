import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { getChatService } from '../../core/services';
import {
  Chat,
  ChatEvent,
  LocalMediaUpload,
  MediaKind,
  Message,
} from '../../core/services/types';
import { useAuthStore } from '../auth/store';
import { decryptFromDirectPeer, encryptForDirectPeer, ensureMyKeyPair } from '../e2ee/keyManager';
import { uploadMedia } from './mediaApi';
import { mergeMessages } from './messageState';
import { friendlyError } from './utils';

interface OutboxItem {
  clientMsgId: string;
  chatId: string;
  kind: 'text' | MediaKind;
  text: string | null;
  mediaFile?: LocalMediaUpload;
  mediaId?: string;
  replyToId?: string;
  createdAt: number;
}

interface ChatStore {
  chats: Chat[];
  messages: Record<string, Message[]>;
  typing: Record<string, boolean>;
  openChatId: string | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  isAppActive: boolean;

  init: () => Promise<void>;
  reset: () => void;
  sync: () => Promise<void>;
  setAppActive: (active: boolean) => void;
  setOpenChat: (chatId: string | null) => void;
  loadOlder: (chatId: string) => Promise<void>;
  send: (chatId: string, text: string, replyToId?: string) => Promise<void>;
  sendMedia: (chatId: string, file: LocalMediaUpload, caption?: string, replyToId?: string) => Promise<void>;
  editMessage: (chatId: string, messageId: string, text: string) => Promise<string | null>;
  deleteMessage: (chatId: string, messageId: string, scope: 'me' | 'everyone') => Promise<void>;
  createGroup: (name: string, memberIds: string[]) => Promise<Chat>;
  markRead: (chatId: string, seq: number) => void;
  setTyping: (chatId: string, isTyping: boolean) => void;
}

let outbox: OutboxItem[] = [];
let isFlushing = false;

export const useChatStore = create<ChatStore>((set, get) => {
  const state = get;

  async function decryptMessagesForChat(chatId: string, list: Message[]): Promise<Message[]> {
    const chat = state().chats.find((c) => c.id === chatId);
    const peerId = chat?.type === 'direct' ? chat.peerId : null;
    const myId = useAuthStore.getState().user?.id;
    if (!myId) return list;

    return Promise.all(
      list.map(async (m) => {
        if (!m.text) return m;
        const { text } = await decryptFromDirectPeer(myId, peerId, m.text);
        return { ...m, text };
      }),
    );
  }

  function applyMessages(chatId: string, incoming: Message[]) {
    set((s) => {
      const current = s.messages[chatId] || [];
      const merged = mergeMessages(current, incoming);
      return {
        messages: { ...s.messages, [chatId]: merged },
        chats: s.chats.map((c) => (c.id === chatId ? { ...c, lastMessage: merged[0] } : c)),
      };
    });
  }

  function markEdited(chatId: string, messageId: string, text: string, editedAt: number) {
    set((s) => {
      const list = (s.messages[chatId] ?? []).map((m) => (m.id === messageId ? { ...m, text, editedAt } : m));
      return {
        messages: { ...s.messages, [chatId]: list },
        chats: s.chats.map((c) => (c.id === chatId ? { ...c, lastMessage: list[0] } : c)),
      };
    });
  }

  function markDeleted(chatId: string, messageId: string) {
    set((s) => {
      const list = (s.messages[chatId] ?? []).map((m) => (m.id === messageId ? { ...m, text: null, deleted: true } : m));
      return {
        messages: { ...s.messages, [chatId]: list },
        chats: s.chats.map((c) => (c.id === chatId ? { ...c, lastMessage: list[0] } : c)),
      };
    });
  }

  async function flushOutbox() {
    if (isFlushing || outbox.length === 0) return;
    isFlushing = true;

    const user = useAuthStore.getState().user;
    if (!user) {
      isFlushing = false;
      return;
    }

    const chatService = getChatService(user.id);

    while (outbox.length > 0) {
      const item = outbox[0];
      try {
        if (item.mediaFile && !item.mediaId) {
          const uploaded = await uploadMedia(item.mediaFile);
          item.mediaId = uploaded.id;
        }

        const chat = state().chats.find((c) => c.id === item.chatId);
        const wireText =
          item.text && chat?.type === 'direct' && chat.peerId
            ? await encryptForDirectPeer(user.id, chat.peerId, item.text)
            : item.text;

        const sent = await chatService.sendMessage({
          chatId: item.chatId,
          clientMsgId: item.clientMsgId,
          kind: item.kind,
          text: wireText,
          mediaId: item.mediaId ?? null,
          replyToId: item.replyToId ?? null,
        });

        const [decryptedSent] = await decryptMessagesForChat(item.chatId, [sent]);
        outbox = outbox.filter((i) => i !== item);
        applyMessages(item.chatId, [decryptedSent]);
      } catch (err) {
        console.error('Failed to send message from outbox:', err);
        // Mark as failed in store
        set((s) => {
          const list = (s.messages[item.chatId] ?? []).map((m) =>
            m.clientMsgId === item.clientMsgId ? { ...m, status: 'failed' as const } : m,
          );
          return { messages: { ...s.messages, [item.chatId]: list } };
        });
        outbox = outbox.filter((i) => i !== item);
      }
    }

    isFlushing = false;
  }

  function handleEvent(event: ChatEvent) {
    switch (event.type) {
      case 'connection':
        set({ connected: event.connected });
        if (event.connected) void flushOutbox();
        break;

      case 'message':
        void (async () => {
          const [decrypted] = await decryptMessagesForChat(event.message.chatId, [event.message]);
          applyMessages(event.message.chatId, [decrypted]);
          if (state().openChatId === event.message.chatId && event.message.seq) {
            state().markRead(event.message.chatId, event.message.seq);
          }
        })();
        break;

      case 'receipt':
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== event.chatId) return c;
            return {
              ...c,
              receipt: {
                delivered: Math.max(c.receipt.delivered, event.deliveredSeq ?? 0),
                read: Math.max(c.receipt.read, event.readSeq ?? 0),
              },
            };
          }),
        }));
        break;

      case 'typing':
        set((s) => ({
          typing: { ...s.typing, [s.openChatId === event.chatId ? event.chatId : '']: event.isTyping },
        }));
        break;

      case 'presence':
        set((s) => ({
          chats: s.chats.map((c) => (c.peerId === event.userId ? { ...c, online: event.online, lastSeenAt: event.lastSeenAt } : c)),
        }));
        break;

      case 'deleted':
        markDeleted(event.chatId, event.messageId);
        break;

      case 'edited':
        markEdited(event.chatId, event.messageId, event.text, event.editedAt);
        break;

      case 'chat_updated':
        void state().sync();
        break;
    }
  }

  return {
    chats: [],
    messages: {},
    typing: {},
    openChatId: null,
    loading: false,
    error: null,
    connected: false,
    isAppActive: true,

    init: async () => {
      const user = useAuthStore.getState().user;
      if (!user) return;

      void ensureMyKeyPair(user.id);

      const service = getChatService(user.id);
      service.subscribe(handleEvent);
      service.connect();

      await state().sync();
    },

    reset: () => {
      const user = useAuthStore.getState().user;
      if (user) getChatService(user.id).disconnect();
      set({ chats: [], messages: {}, typing: {}, openChatId: null });
    },

    sync: async () => {
      const user = useAuthStore.getState().user;
      if (!user) return;

      set({ loading: true, error: null });
      try {
        const chats = await getChatService(user.id).listChats();
        set({ chats, loading: false });
      } catch (err) {
        set({ error: friendlyError(err), loading: false });
      }
    },

    setAppActive: (active) => set({ isAppActive: active }),
    setOpenChat: (chatId) => set({ openChatId: chatId }),

    loadOlder: async (chatId) => {
      const user = useAuthStore.getState().user;
      if (!user) return;

      const current = state().messages[chatId] || [];
      const oldestSeq = current[current.length - 1]?.seq;

      try {
        const { messages } = await getChatService(user.id).fetchMessages(chatId, { before: oldestSeq });
        const decrypted = await decryptMessagesForChat(chatId, messages);
        applyMessages(chatId, decrypted);
      } catch {
        // ignore
      }
    },

    send: async (chatId, text, replyToId) => {
      const user = useAuthStore.getState().user;
      if (!user) return;

      const clientMsgId = Crypto.randomUUID();
      const localMsg: Message = {
        id: clientMsgId,
        clientMsgId,
        chatId,
        senderId: user.id,
        kind: 'text',
        text,
        createdAt: Date.now(),
        status: 'sending',
        replyToId: replyToId ?? null,
      };

      applyMessages(chatId, [localMsg]);

      outbox.push({
        clientMsgId,
        chatId,
        kind: 'text',
        text,
        replyToId,
        createdAt: localMsg.createdAt,
      });

      void flushOutbox();
    },

    sendMedia: async (chatId, file, caption, replyToId) => {
      const user = useAuthStore.getState().user;
      if (!user) return;

      const clientMsgId = Crypto.randomUUID();
      const localMsg: Message = {
        id: clientMsgId,
        clientMsgId,
        chatId,
        senderId: user.id,
        kind: file.kind,
        text: caption || null,
        media: {
          id: 'temp',
          kind: file.kind,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes || 0,
          fileName: file.fileName,
          url: file.uri,
        },
        createdAt: Date.now(),
        status: 'sending',
        replyToId: replyToId ?? null,
      };

      applyMessages(chatId, [localMsg]);

      outbox.push({
        clientMsgId,
        chatId,
        kind: file.kind,
        text: caption || null,
        mediaFile: file,
        replyToId,
        createdAt: localMsg.createdAt,
      });

      void flushOutbox();
    },

    editMessage: async (chatId, messageId, text) => {
      const user = useAuthStore.getState().user;
      if (!user) return 'Not authenticated';

      try {
        const editedAt = await getChatService(user.id).editMessage(chatId, messageId, text);
        markEdited(chatId, messageId, text.trim(), editedAt);
        return null;
      } catch (err) {
        return friendlyError(err);
      }
    },

    deleteMessage: async (chatId, messageId, scope) => {
      const user = useAuthStore.getState().user;
      if (!user) return;

      try {
        await getChatService(user.id).deleteMessage(chatId, messageId, scope);
        markDeleted(chatId, messageId);
      } catch {
        // ignore
      }
    },

    createGroup: async (name, memberIds) => {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');

      const chat = await getChatService(user.id).createGroupChat(name, memberIds);
      await state().sync();
      return chat;
    },

    markRead: (chatId, seq) => {
      const user = useAuthStore.getState().user;
      if (user) getChatService(user.id).markRead(chatId, seq);
    },

    setTyping: (chatId, isTyping) => {
      const user = useAuthStore.getState().user;
      if (user) getChatService(user.id).setTyping(chatId, isTyping);
    },
  };
});
