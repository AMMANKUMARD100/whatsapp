import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/core/theme/ThemeProvider';
import { Avatar } from '../src/features/chat/components/Avatar';
import { useChatStore } from '../src/features/chat/store';
import { FindByNumber } from '../src/features/contacts/FindByNumber';
import { shareInviteLink } from '../src/features/contacts/invite';
import { useContactsStore } from '../src/features/contacts/store';
import { MatchedUser } from '../src/features/contacts/types';

export default function ContactsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { registeredUsers, deviceContacts, loading, sync } = useContactsStore();
  const { openDirectChat } = useChatStore.getState();

  useEffect(() => {
    void sync();
  }, [sync]);

  const startChat = async (user: MatchedUser) => {
    try {
      const chat = await useChatStore.getState().chats.find((c) => c.peerId === user.id);
      if (chat) {
        router.push(`/chat/${chat.id}`);
      } else {
        // Find or create direct chat
        const { getChatService } = await import('../src/core/services');
        const { useAuthStore } = await import('../src/features/auth/store');
        const myId = useAuthStore.getState().user?.id;
        if (!myId) return;
        const newChat = await getChatService(myId).openDirectChat(user.id);
        await useChatStore.getState().sync();
        router.push(`/chat/${newChat.id}`);
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={registeredUsers}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ paddingBottom: spacing.md }}>
            <Pressable
              onPress={() => router.push('/group/new')}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                paddingBottom: spacing.md,
              }}
            >
              <Avatar name="New Group" color={colors.primary} />
              <Text style={[typography.heading, { color: colors.textPrimary }]}>New group</Text>
            </Pressable>

            <View style={{ paddingHorizontal: spacing.lg }}>
              <FindByNumber onSelectUser={startChat} />
            </View>

            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
              ]}
            >
              CONTACTS ON CHATTERLY ({registeredUsers.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => startChat(item)}
            style={({ pressed }) => [
              styles.contactItem,
              {
                backgroundColor: pressed ? colors.surfaceAlt : colors.background,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <Avatar name={item.name} uri={item.avatarUrl} size={46} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={[typography.heading, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
                {item.about}
              </Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          deviceContacts.length > 0 ? (
            <View style={{ padding: spacing.lg }}>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                INVITE TO CHATTERLY
              </Text>
              {deviceContacts.slice(0, 20).map((c) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.sm,
                  }}
                >
                  <View>
                    <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{c.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{c.phoneNumber}</Text>
                  </View>
                  <Pressable
                    onPress={() => void shareInviteLink(c.phoneNumber)}
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: radius.pill,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>Invite</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null
        }
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
