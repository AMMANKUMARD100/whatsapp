import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemeMode, useTheme, useThemeStore } from '../../src/core/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/store';
import { Avatar } from '../../src/features/chat/components/Avatar';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export default function SettingsTabScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { mode, setMode } = useThemeStore();
  const { user, signOut } = useAuthStore();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <Pressable
        onPress={() => router.push('/profile')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
        }}
      >
        <Avatar name={user?.name || 'User'} uri={user?.avatarUrl} size={60} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>{user?.name || 'Set your name'}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{user?.about || 'Hey there! I am using Chatterly'}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{user?.phone}</Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Edit</Text>
      </Pressable>

      <Text style={[typography.heading, { color: colors.primary, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        Appearance
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                alignItems: 'center',
                borderRadius: radius.md,
                backgroundColor: active ? colors.primary : colors.surfaceAlt,
              }}
            >
              <Text style={{ color: active ? colors.onPrimary : colors.textPrimary, fontWeight: '600' }}>
                {m.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[typography.heading, { color: colors.primary, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        Session & Security
      </Text>
      <Pressable
        onPress={() => void signOut(false)}
        style={{ padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginBottom: spacing.sm }}
      >
        <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 16 }}>Log out this device</Text>
      </Pressable>
      <Pressable
        onPress={() => void signOut(true)}
        style={{ padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md }}
      >
        <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 16 }}>Log out from all devices</Text>
      </Pressable>
    </ScrollView>
  );
}
