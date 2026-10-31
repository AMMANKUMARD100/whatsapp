import React, { useRef } from 'react';
import {
  Animated,
  Image,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Message, MessageStatus } from '../../../core/services/types';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { refreshMediaUrl } from '../mediaApi';
import { dayLabel, formatBytes, formatTime, isSameDay, messageSummary } from '../utils';
import { StatusTicks } from './StatusTicks';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface Props {
  message: Message;
  status: MessageStatus;
  olderMessage?: Message;
  isMine: boolean;
  showSenderName?: boolean;
  repliedTo?: Message;
  repliedToName?: string;
  onLongPress: (message: Message) => void;
  onRetry: (message: Message) => void;
  onOpenImage: (uri: string, caption?: string | null) => void;
  onSwipeReply?: (message: Message) => void;
}

export function MessageBubble({
  message,
  status,
  olderMessage,
  isMine,
  showSenderName,
  repliedTo,
  repliedToName,
  onLongPress,
  onRetry,
  onOpenImage,
  onSwipeReply,
}: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < 10,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0 && gesture.dx < 80) {
          panX.setValue(gesture.dx);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 60 && onSwipeReply) {
          onSwipeReply(message);
        }
        Animated.spring(panX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const showDate = !olderMessage || !isSameDay(olderMessage.createdAt, message.createdAt);
  const deleted = !!message.deleted;
  const media = message.media;

  const openDocument = async () => {
    if (!media) return;
    try {
      const url = media.url.startsWith('http') ? await refreshMediaUrl(media.id).catch(() => media.url) : media.url;
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <View>
      {showDate && (
        <View style={[styles.datePill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{dayLabel(message.createdAt)}</Text>
        </View>
      )}

      <Animated.View
        style={{ transform: [{ translateX: panX }] }}
        {...panResponder.panHandlers}
      >
        <View style={{ alignItems: isMine ? 'flex-end' : 'flex-start', paddingHorizontal: spacing.md, marginVertical: 2 }}>
          <Pressable
            onLongPress={() => onLongPress(message)}
            style={[
              styles.bubble,
              {
                backgroundColor: isMine ? colors.bubbleOut : colors.bubbleIn,
                borderRadius: radius.md,
                borderTopRightRadius: isMine ? 2 : radius.md,
                borderTopLeftRadius: !isMine ? 2 : radius.md,
                maxWidth: '80%',
              },
            ]}
          >
            {showSenderName && message.senderName && !isMine && (
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, marginBottom: 2 }}>
                {message.senderName}
              </Text>
            )}

            {repliedTo && (
              <View style={[styles.replyContainer, { borderLeftColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  {repliedToName ?? 'Message'}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary }}>
                  {messageSummary(repliedTo)}
                </Text>
              </View>
            )}

            {deleted ? (
              <Text style={{ color: colors.textSecondary, fontStyle: 'italic', fontSize: 14 }}>
                🚫 This message was deleted
              </Text>
            ) : (
              <>
                {media?.kind === 'image' && (
                  <Pressable onPress={() => onOpenImage(media.url, message.text)}>
                    <Image
                      source={{ uri: media.url }}
                      style={{ width: 220, height: 220, borderRadius: radius.sm, marginBottom: 4 }}
                      resizeMode="cover"
                    />
                  </Pressable>
                )}

                {media?.kind === 'audio' && (
                  <VoiceNotePlayer url={media.url} durationMs={media.durationMs} isMine={isMine} />
                )}

                {media?.kind === 'document' && (
                  <Pressable
                    onPress={openDocument}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 }}
                  >
                    <Text style={{ fontSize: 24 }}>📄</Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontWeight: '600', color: colors.textPrimary }}>
                        {media.fileName}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {formatBytes(media.sizeBytes)}
                      </Text>
                    </View>
                  </Pressable>
                )}

                {message.text && (
                  <Text style={[typography.body, { color: colors.textPrimary }]}>
                    {message.text}
                  </Text>
                )}
              </>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
              {message.editedAt && !deleted && (
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' }}>
                  edited
                </Text>
              )}
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                {formatTime(message.createdAt)}
              </Text>
              {isMine && <StatusTicks status={status} />}
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  datePill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1,
    elevation: 1,
  },
  replyContainer: {
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
});
