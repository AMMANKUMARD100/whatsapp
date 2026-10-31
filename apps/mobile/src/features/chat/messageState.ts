import { Message, MessageStatus, Receipt } from '../../core/services/types';

export function effectiveStatus(
  msg: Message,
  receipt: Receipt,
  isMine: boolean,
): MessageStatus {
  if (!isMine) return 'read';
  if (msg.status === 'sending' || msg.status === 'failed') return msg.status;
  if (!msg.seq) return 'sent';
  if (receipt.read >= msg.seq) return 'read';
  if (receipt.delivered >= msg.seq) return 'delivered';
  return 'sent';
}

export function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const map = new Map<string, Message>();
  existing.forEach((m) => map.set(m.clientMsgId, m));
  incoming.forEach((m) => {
    const prev = map.get(m.clientMsgId);
    if (!prev) {
      map.set(m.clientMsgId, m);
    } else {
      map.set(m.clientMsgId, { ...prev, ...m });
    }
  });

  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}
