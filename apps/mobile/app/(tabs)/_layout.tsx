import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { HeaderActions } from '../../src/features/auth/HeaderActions';
import { useChatStore } from '../../src/features/chat/store';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { chats } = useChatStore();

  const totalUnread = chats.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          headerRight: () => <HeaderActions />,
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Calls',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
