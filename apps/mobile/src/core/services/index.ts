import { RealChatService } from './realChatService';
import type { ChatService } from './types';

let chatServiceInstance: ChatService | null = null;

export function getChatService(userId?: string): ChatService {
  if (!chatServiceInstance && userId) {
    chatServiceInstance = new RealChatService(userId);
  }
  return chatServiceInstance!;
}

export function setChatService(service: ChatService | null) {
  chatServiceInstance = service;
}
