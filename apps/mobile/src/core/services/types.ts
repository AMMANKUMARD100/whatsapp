export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MediaKind = 'image' | 'audio' | 'document';

export interface MediaAttachment {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  url: string;
}

export interface LocalMediaUpload {
  uri: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes?: number;
  fileName: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface Message {
  id: string;
  clientMsgId: string;
  chatId: string;
  senderId: string;
  senderName?: string | null;
  kind: 'text' | MediaKind;
  text: string | null;
  media?: MediaAttachment | null;
  createdAt: number;
  editedAt?: number | null;
  status: MessageStatus;
  replyToId?: string | null;
  seq?: number;
  deleted?: boolean;
}

export interface Receipt {
  delivered: number;
  read: number;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  peerId: string | null;
  name: string;
  about: string;
  avatarUri?: string;
  myRole: 'admin' | 'member';
  memberCount: number;
  online: boolean;
  lastSeenAt: number | null;
  unread: number;
  lastSeq: number;
  lastMessage?: Message;
  receipt: Receipt;
}

export type ChatEvent =
  | { type: 'connection'; connected: boolean }
  | { type: 'message'; message: Message }
  | { type: 'receipt'; chatId: string; userId: string; deliveredSeq?: number; readSeq?: number }
  | { type: 'typing'; chatId: string; userId: string; isTyping: boolean }
  | { type: 'presence'; userId: string; online: boolean; lastSeenAt: number | null }
  | { type: 'deleted'; chatId: string; messageId: string }
  | { type: 'edited'; chatId: string; messageId: string; text: string; editedAt: number }
  | { type: 'chat_updated'; chatId: string };

export class SendError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) {
    super(code);
  }
}

export interface ChatService {
  readonly currentUserId: string;
  connect(): void;
  disconnect(): void;
  listChats(): Promise<Chat[]>;
  openDirectChat(userId: string): Promise<Chat>;
  createGroupChat(name: string, memberIds: string[]): Promise<Chat>;
  fetchMessages(
    chatId: string,
    opts?: { before?: number; after?: number; limit?: number },
  ): Promise<{ messages: Message[]; hasMore: boolean }>;
  sendMessage(input: {
    chatId: string;
    clientMsgId: string;
    kind?: 'text' | MediaKind;
    text?: string | null;
    mediaId?: string | null;
    replyToId?: string | null;
  }): Promise<Message>;
  editMessage(chatId: string, messageId: string, text: string): Promise<number>;
  deleteMessage(chatId: string, messageId: string, scope: 'me' | 'everyone'): Promise<void>;
  markDelivered(chatId: string, seq: number): void;
  markRead(chatId: string, seq: number): void;
  setTyping(chatId: string, isTyping: boolean): void;
  subscribe(listener: (event: ChatEvent) => void): () => void;
}
