import { describe, expect, it } from 'vitest';
import { effectiveStatus, mergeMessages } from './messageState';

describe('messageState', () => {
  it('derives status from receipts', () => {
    const msg = {
      id: '1',
      clientMsgId: 'c1',
      chatId: 'chat1',
      senderId: 'me',
      text: 'hi',
      createdAt: 100,
      status: 'sent' as const,
      seq: 5,
    };

    expect(effectiveStatus(msg, { delivered: 4, read: 4 }, true)).toBe('sent');
    expect(effectiveStatus(msg, { delivered: 5, read: 4 }, true)).toBe('delivered');
    expect(effectiveStatus(msg, { delivered: 5, read: 5 }, true)).toBe('read');
  });

  it('merges messages newest first deduplicating by clientMsgId', () => {
    const m1 = { id: '1', clientMsgId: 'c1', chatId: 'c', senderId: 'me', text: '1', createdAt: 10, status: 'sent' as const };
    const m2 = { id: '2', clientMsgId: 'c2', chatId: 'c', senderId: 'me', text: '2', createdAt: 20, status: 'sent' as const };
    const merged = mergeMessages([m1], [m2]);
    expect(merged).toHaveLength(2);
    expect(merged[0].clientMsgId).toBe('c2');
  });
});
