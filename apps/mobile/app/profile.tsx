import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/core/theme/ThemeProvider';
import { useAuthStore } from '../src/features/auth/store';
import { Avatar } from '../src/features/chat/components/Avatar';
import { profileApi } from '../src/features/profile/profileApi';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { user, setUser } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [about, setAbout] = useState(user?.about || 'Hey there! I am using Chatterly');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      try {
        const res = await profileApi.uploadAvatar(result.assets[0].base64);
        setAvatarUri(res.avatarUrl);
        if (user) setUser({ ...user, avatarUrl: res.avatarUrl });
      } catch (err) {
        setError((err as Error).message);
      }
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await profileApi.updateProfile({
        name: trimmedName,
        about: about.trim() || undefined,
      });
      setUser(updated);
      router.replace('/(tabs)');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <View style={{ alignItems: 'center', marginVertical: spacing.xl }}>
          <Pressable onPress={pickAvatar}>
            <Avatar name={name || 'User'} uri={avatarUri} size={100} />
            <Text style={{ color: colors.primary, marginTop: spacing.sm, fontWeight: '600' }}>
              Change photo
            </Text>
          </Pressable>
        </View>

        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
          Your Name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Doe"
          placeholderTextColor={colors.textSecondary}
          maxLength={60}
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: 16,
            marginBottom: spacing.lg,
          }}
        />

        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
          About
        </Text>
        <TextInput
          value={about}
          onChangeText={setAbout}
          placeholder="Status message"
          placeholderTextColor={colors.textSecondary}
          maxLength={139}
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: 16,
            marginBottom: spacing.xl,
          }}
        />

        {error && (
          <Text style={{ color: colors.danger, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' }}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={handleSave}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.pill,
            paddingVertical: spacing.md,
            alignItems: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: '700' }}>
              Save
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
