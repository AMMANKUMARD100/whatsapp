import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/store';
import { Avatar } from '../../src/features/chat/components/Avatar';
import { EmptyState } from '../../src/features/chat/components/EmptyState';
import { ImageViewerModal } from '../../src/features/chat/components/ImageViewerModal';
import { MessageBubble } from '../../src/features/chat/components/MessageBubble';
import { MessageInput } from '../../src/features/chat/components/MessageInput';
import { TypingIndicator } from '../../src/features/chat/components/TypingIndicator';
import { effectiveStatus } from '../../src/features/chat/messageState';
import { useChatStore } from '../../src/features/chat/store';
import { formatTime, messageSummary } from '../../src/features/chat/utils';
import { getSafetyNumberWithPeer } from '../../src/features/e2ee/keyManager';
import { Message } from '../../src/core/services/types';

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { user } = useAuthStore();
  const me = user?.id;

  const {
    chats,
    messages,
    typing,
    loadOlder,
    send,
    sendMedia,
    editMessage,
    deleteMessage,
    markRead,
    setTyping,
    setOpenChat,
  } = useChatStore();

  const chat = chats.find((c) => c.id === chatId);
  const isGroup = chat?.type === 'group';
  const list = messages[chatId] || [];
  const isTyping = !!typing[chatId];
  const receipt = chat?.receipt || { delivered: 0, read: 0 };

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [viewer, setViewer] = useState<{ uri: string; caption?: string | null } | null>(null);
  const [safetyCode, setSafetyCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const typingTimeout = useRef<any>(null);

  useEffect(() => {
    setOpenChat(chatId);
    if (list.length > 0 && list[0].seq) {
      markRead(chatId, list[0].seq);
    }
    return () => {
      setOpenChat(null);
    };
  }, [chatId, list[0]?.seq]);

  const onTextChange = (t: string) => {
    setTyping(chatId, t.length > 0);
    clearTimeout(typingTimeout.current);
    if (t.length > 0) {
      typingTimeout.current = setTimeout(() => {
        setTyping(chatId, false);
      }, 3000);
    }
  };

  const handleEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    const err = await editMessage(chatId, editingMsg.id, editText.trim());
    if (err) setNotice(err);
    setEditingMsg(null);
    setEditText('');
  };

  const handleForward = (targetChatId: string) => {
    if (!forwardMsg) return;
    if (forwardMsg.text) {
      void send(targetChatId, forwardMsg.text);
    }
    setForwardMsg(null);
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === me;
    const status = effectiveStatus(item, receipt, isMine);
    const olderMessage = list[index + 1];
    const repliedTo = item.replyToId ? list.find((m) => m.id === item.replyToId || m.clientMsgId === item.replyToId) : undefined;

    return (
      <MessageBubble
        message={item}
        status={status}
        olderMessage={olderMessage}
        isMine={isMine}
        showSenderName={isGroup}
        repliedTo={repliedTo}
        repliedToName={repliedTo ? (repliedTo.senderId === me ? 'You' : repliedTo.senderName || 'Peer') : undefined}
        onLongPress={(m) => setMenuFor(m)}
        onRetry={() => void send(chatId, item.text || '')}
        onOpenImage={(uri, caption) => setViewer({ uri, caption })}
        onSwipeReply={(m) => setReplyTo(m)}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              onPress={() => isGroup && router.push(`/group/${chatId}`)}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Avatar name={chat?.name || 'Chat'} uri={chat?.avatarUri} size={36} />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typography.heading, { color: colors.textPrimary, fontSize: 16 }]} numberOfLines={1}>
                  {chat?.name || 'Chat'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {isTyping
                    ? 'typing…'
                    : isGroup
                    ? `${chat?.memberCount || 0} members`
                    : chat?.online
                    ? 'online'
                    : chat?.lastSeenAt
                    ? `last seen ${formatTime(chat.lastSeenAt)}`
                    : ''}
                </Text>
              </View>
            </Pressable>
          ),
        }}
      />

      {list.length === 0 ? (
        <EmptyState title="No messages yet" subtitle="Say hello 👋" />
      ) : (
        <FlashList
          data={list}
          inverted
          keyExtractor={(m) => m.clientMsgId}
          estimatedItemSize={72}
          renderItem={renderItem}
          extraData={receipt}
          onEndReached={() => loadOlder(chatId)}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
          ListFooterComponent={
            !isGroup && chat?.peerId ? (
              <Pressable
                onPress={async () => {
                  if (me && chat.peerId) setSafetyCode(await getSafetyNumberWithPeer(me, chat.peerId));
                }}
                style={{
                  alignSelf: 'center',
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  marginVertical: spacing.sm,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>
                  🔒 Messages are end-to-end encrypted. Tap to verify safety number.
                </Text>
                {safetyCode && (
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, textAlign: 'center', marginTop: 2 }}>
                    Safety number: {safetyCode}
                  </Text>
                )}
              </Pressable>
            ) : null
          }
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {notice && (
        <View style={{ backgroundColor: colors.danger, padding: spacing.xs, alignItems: 'center' }}>
          <Text style={{ color: colors.onPrimary, fontSize: 12 }}>{notice}</Text>
        </View>
      )}

      <MessageInput
        replyPreview={
          replyTo
            ? {
                name: replyTo.senderId === me ? 'You' : replyTo.senderName || 'Peer',
                text: messageSummary(replyTo),
              }
            : undefined
        }
        onCancelReply={() => setReplyTo(null)}
        onTextChange={onTextChange}
        onError={setNotice}
        onSend={(text) => {
          setTyping(chatId, false);
          void send(chatId, text, replyTo?.id);
          setReplyTo(null);
        }}
        onSendMedia={(file, caption) => {
          setTyping(chatId, false);
          void sendMedia(chatId, file, caption, replyTo?.id);
          setReplyTo(null);
        }}
      />

      <ImageViewerModal uri={viewer?.uri ?? null} caption={viewer?.caption} onClose={() => setViewer(null)} />

      {/* Message action menu */}
      <Modal transparent visible={!!menuFor} animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable
          onPress={() => setMenuFor(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, minWidth: 240, overflow: 'hidden' }}>
            <Pressable
              onPress={() => {
                if (menuFor?.text) void Clipboard.setStringAsync(menuFor.text);
                setMenuFor(null);
              }}
              style={{ padding: spacing.lg }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Copy</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (menuFor) setReplyTo(menuFor);
                setMenuFor(null);
              }}
              style={{ padding: spacing.lg }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Reply</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setForwardMsg(menuFor);
                setMenuFor(null);
              }}
              style={{ padding: spacing.lg }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Forward</Text>
            </Pressable>

            {menuFor?.senderId === me && !menuFor.deleted && Date.now() - menuFor.createdAt <= 15 * 60 * 1000 && (
              <Pressable
                onPress={() => {
                  setEditingMsg(menuFor);
                  setEditText(menuFor.text || '');
                  setMenuFor(null);
                }}
                style={{ padding: spacing.lg }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Edit</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                if (menuFor) void deleteMessage(chatId, menuFor.id, 'me');
                setMenuFor(null);
              }}
              style={{ padding: spacing.lg }}
            >
              <Text style={{ color: colors.danger, fontSize: 16 }}>Delete for me</Text>
            </Pressable>

            {menuFor?.senderId === me && (
              <Pressable
                onPress={() => {
                  if (menuFor) void deleteMessage(chatId, menuFor.id, 'everyone');
                  setMenuFor(null);
                }}
                style={{ padding: spacing.lg }}
              >
                <Text style={{ color: colors.danger, fontSize: 16 }}>Delete for everyone</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editingMsg} transparent animationType="fade" onRequestClose={() => setEditingMsg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg }}>
            <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Edit message</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.sm,
                padding: spacing.md,
                color: colors.textPrimary,
                maxHeight: 120,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md }}>
              <Pressable onPress={() => setEditingMsg(null)} style={{ padding: spacing.sm }}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleEdit} style={{ padding: spacing.sm }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Forward modal */}
      <Modal visible={!!forwardMsg} transparent animationType="slide" onRequestClose={() => setForwardMsg(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, maxHeight: '60%', padding: spacing.lg }}>
            <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: spacing.md }]}>Forward to…</Text>
            {chats.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => handleForward(c.id)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }}
              >
                <Avatar name={c.name} uri={c.avatarUri} size={40} />
                <Text style={{ color: colors.textPrimary, fontSize: 16, marginLeft: spacing.md }}>{c.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setForwardMsg(null)} style={{ padding: spacing.md, alignItems: 'center', marginTop: spacing.sm }}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
