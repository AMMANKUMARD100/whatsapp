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
import { useRouter } from 'expo-router';
import { useTheme } from '../src/core/theme/ThemeProvider';
import { authApi } from '../src/features/auth/authApi';
import { getDeviceInfo } from '../src/features/auth/device';
import { normalizePhone } from '../src/features/auth/phone';
import { useAuthStore } from '../src/features/auth/store';

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { signIn } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Enter a valid phone number with country code (e.g. +14155552671)');
      return;
    }

    setLoading(true);
    setError(null);

    // In dev mode, offer dev login fallback
    try {
      await authApi.sendOtp(normalized);
      router.push({ pathname: '/otp', params: { phone: normalized } });
    } catch {
      // If OTP provider fails in local dev, allow dev-login
      try {
        const session = await authApi.devLogin(normalized);
        await signIn(session);
      } catch (devErr) {
        setError((devErr as Error).message);
      }
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
        <Text style={[typography.title, { color: colors.primary, textAlign: 'center', marginBottom: spacing.sm }]}>
          Chatterly
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl }]}>
          Verify your phone number to start end-to-end encrypted messaging.
        </Text>

        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 234 567 8900"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          autoFocus
          style={{
            backgroundColor: colors.surfaceAlt,
            color: colors.textPrimary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: 18,
            marginBottom: spacing.md,
          }}
        />

        {error && (
          <Text style={{ color: colors.danger, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' }}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={handleSendOtp}
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
              Next
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
