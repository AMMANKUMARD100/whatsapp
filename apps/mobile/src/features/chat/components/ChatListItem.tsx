import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chat } from '../../../core/services/types';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { formatTime, messageSummary } from '../utils';
import { Avatar } from './Avatar';
import { StatusTicks } from './StatusTicks';

interface Props {
  chat: Chat;
  isTyping: boolean;
  onPress: () => void;
}

export function ChatListItem({ chat, isTyping, onPress }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.surfaceAlt : colors.background,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
      ]}
    >
      <Avatar name={chat.name} uri={chat.avatarUri} size={50} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={1}>
            {chat.name}
          </Text>
          {chat.lastMessage && (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {formatTime(chat.lastMessage.createdAt)}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm }}>
            {chat.lastMessage && chat.lastMessage.senderId !== chat.peerId && (
              <View style={{ marginRight: 4 }}>
                <StatusTicks status={chat.lastMessage.status} />
              </View>
            )}
            <Text
              style={{
                color: isTyping ? colors.primary : colors.textSecondary,
                fontSize: 14,
                fontStyle: isTyping ? 'italic' : 'normal',
              }}
              numberOfLines={1}
            >
              {isTyping ? 'typing…' : messageSummary(chat.lastMessage)}
            </Text>
          </View>

          {chat.unread > 0 && (
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                minWidth: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '700' }}>
                {chat.unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
