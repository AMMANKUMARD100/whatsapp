import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { ChatListItem } from '../../src/features/chat/components/ChatListItem';
import { EmptyState } from '../../src/features/chat/components/EmptyState';
import { useChatStore } from '../../src/features/chat/store';

export default function ChatsTabScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { chats, typing, loading, error, init } = useChatStore();

  useEffect(() => {
    void init();
  }, [init]);

  const sorted = useMemo(
    () => [...chats].sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0)),
    [chats],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {loading && chats.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState title="Something went wrong" subtitle={error} actionLabel="Try again" onAction={init} />
      ) : (
        <FlashList
          data={sorted}
          keyExtractor={(c) => c.id}
          estimatedItemSize={76}
          extraData={typing}
          renderItem={({ item }) => (
            <ChatListItem chat={item} isTyping={!!typing[item.id]} onPress={() => router.push(`/chat/${item.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No chats yet"
              subtitle="Start a new chat to connect with friends"
              actionLabel="Find Contacts"
              onAction={() => router.push('/contacts')}
            />
          }
        />
      )}

      {/* Floating Action Button (FAB) to start a new chat */}
      <Pressable
        onPress={() => router.push('/contacts')}
        style={[styles.fab, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.fabIcon}>💬</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 24,
  },
});
