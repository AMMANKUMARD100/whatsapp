import { io, Socket } from 'socket.io-client';
import { resolveAssetUrl } from '../api/assetUrl';
import { apiFetch, API_BASE } from '../api/client';
import { storage } from '../storage/secureStorage';
import {
  Chat,
  ChatEvent,
  ChatService,
  MediaKind,
  Message,
  SendError,
} from './types';

interface ServerMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string | null;
  clientMsgId: string;
  seq: number;
  kind: 'text' | MediaKind;
  text: string | null;
  media?: any;
  replyToId: string | null;
  createdAt: number;
  editedAt?: number | null;
  deleted: boolean;
}

function toMessage(m: ServerMessage): Message {
  return {
    id: m.id,
    clientMsgId: m.clientMsgId,
    chatId: m.chatId,
    senderId: m.senderId,
    senderName: m.senderName ?? null,
    kind: m.kind ?? 'text',
    text: m.text,
    media: m.media ? { ...m.media, url: resolveAssetUrl(m.media.url) ?? m.media.url } : null,
    createdAt: m.createdAt,
    editedAt: m.editedAt ?? null,
    status: 'sent',
    replyToId: m.replyToId,
    seq: m.seq,
    deleted: m.deleted,
  };
}

export class RealChatService implements ChatService {
  private socket: Socket | null = null;
  private listeners = new Set<(event: ChatEvent) => void>();

  constructor(public readonly currentUserId: string) {}

  private emit(event: ChatEvent) {
    this.listeners.forEach((l) => l(event));
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await storage.get('accessToken');
    if (!token) return;

    this.socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.emit({ type: 'connection', connected: true });
    });

    this.socket.on('disconnect', () => {
      this.emit({ type: 'connection', connected: false });
    });

    this.socket.on('message:new', (msg: ServerMessage) => {
      this.emit({ type: 'message', message: toMessage(msg) });
    });

    this.socket.on('receipt', (d: { chatId: string; userId: string; deliveredSeq?: number; readSeq?: number }) => {
      this.emit({ type: 'receipt', ...d });
    });

    this.socket.on('typing', (d: { chatId: string; userId: string; isTyping: boolean }) => {
      this.emit({ type: 'typing', ...d });
    });

    this.socket.on('presence', (d: { userId: string; online: boolean; lastSeenAt: number | null }) => {
      this.emit({ type: 'presence', ...d });
    });

    this.socket.on('message:deleted', (d: { chatId: string; messageId: string }) => {
      this.emit({ type: 'deleted', ...d });
    });

    this.socket.on('message:edited', (d: { chatId: string; messageId: string; text: string; editedAt: number }) => {
      this.emit({ type: 'edited', ...d });
    });

    this.socket.on('chat_updated', (d: { chatId: string }) => {
      this.emit({ type: 'chat_updated', ...d });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async listChats(): Promise<Chat[]> {
    const res = await apiFetch<{ chats: Chat[] }>('/chats');
    return res.chats;
  }

  async openDirectChat(userId: string): Promise<Chat> {
    const res = await apiFetch<{ id: string }>('/chats/direct', {
      method: 'POST',
      body: { userId },
    });
    const chats = await this.listChats();
    const found = chats.find((c) => c.id === res.id);
    if (!found) throw new Error('Failed to find created chat');
    return found;
  }

  async createGroupChat(name: string, memberIds: string[]): Promise<Chat> {
    const res = await apiFetch<{ id: string }>('/groups', {
      method: 'POST',
      body: { name, memberIds },
    });
    const chats = await this.listChats();
    const found = chats.find((c) => c.id === res.id);
    if (!found) throw new Error('Failed to find created group chat');
    return found;
  }

  async fetchMessages(
    chatId: string,
    opts?: { before?: number; after?: number; limit?: number },
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (opts?.before) query.set('before', String(opts.before));
    if (opts?.after) query.set('after', String(opts.after));
    if (opts?.limit) query.set('limit', String(opts.limit));

    const qs = query.toString();
    const res = await apiFetch<{ messages: ServerMessage[]; hasMore: boolean }>(
      `/chats/${chatId}/messages${qs ? `?${qs}` : ''}`,
    );

    return {
      messages: res.messages.map(toMessage),
      hasMore: res.hasMore,
    };
  }

  async sendMessage(input: {
    chatId: string;
    clientMsgId: string;
    kind?: 'text' | MediaKind;
    text?: string | null;
    mediaId?: string | null;
    replyToId?: string | null;
  }): Promise<Message> {
    if (!this.socket?.connected) {
      throw new SendError('offline', true);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new SendError('timeout', true));
      }, 10000);

      this.socket?.emit(
        'message:send',
        {
          chatId: input.chatId,
          clientMsgId: input.clientMsgId,
          kind: input.kind ?? 'text',
          text: input.text ?? null,
          mediaId: input.mediaId ?? null,
          replyToId: input.replyToId ?? null,
        },
        (res: any) => {
          clearTimeout(timer);
          if (res?.error) {
            reject(new SendError(res.error, false));
          } else if (res?.message) {
            resolve(toMessage(res.message));
          }
        },
      );

      // Listen for message echo as success fallback
      const listener = (msg: ServerMessage) => {
        if (msg.clientMsgId === input.clientMsgId && msg.chatId === input.chatId) {
          clearTimeout(timer);
          this.socket?.off('message:new', listener);
          resolve(toMessage(msg));
        }
      };
      this.socket.on('message:new', listener);
    });
  }

  async editMessage(chatId: string, messageId: string, text: string): Promise<number> {
    const res = await apiFetch<{ editedAt: number }>(`/chats/${chatId}/messages/${messageId}`, {
      method: 'PATCH',
      body: { text },
    });
    return res.editedAt;
  }

  async deleteMessage(chatId: string, messageId: string, scope: 'me' | 'everyone'): Promise<void> {
    await apiFetch(`/chats/${chatId}/messages/${messageId}?scope=${scope}`, {
      method: 'DELETE',
    });
  }

  markDelivered(chatId: string, seq: number): void {
    this.socket?.connected && this.socket.emit('message:delivered', { chatId, seq });
  }

  markRead(chatId: string, seq: number): void {
    this.socket?.connected && this.socket.emit('message:read', { chatId, seq });
  }

  setTyping(chatId: string, isTyping: boolean): void {
    this.socket?.connected && this.socket.emit('typing', { chatId, isTyping });
  }

  subscribe(listener: (event: ChatEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
