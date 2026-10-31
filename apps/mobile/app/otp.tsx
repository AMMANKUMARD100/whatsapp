import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/core/theme/ThemeProvider';
import { authApi } from '../src/features/auth/authApi';
import { getDeviceInfo } from '../src/features/auth/device';
import { useAuthStore } from '../src/features/auth/store';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const { signIn } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!code || code.length < 4) {
      setError('Enter 6-digit verification code');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const dev = getDeviceInfo();
      const session = await authApi.verifyOtp({
        phone,
        code,
        deviceId: dev.deviceId,
        platform: dev.platform,
      });
      await signIn(session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl }]}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[typography.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs }]}>
          Verify code
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
          Enter the code sent to {phone}
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: 24,
            textAlign: 'center',
            letterSpacing: 8,
            marginBottom: spacing.md,
          }}
        />

        {error && (
          <Text style={{ color: colors.danger, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' }}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={handleVerify}
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
              Verify
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
