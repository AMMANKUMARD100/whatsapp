import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';
import { normalizePhone } from '../auth/phone';
import { contactsApi } from './contactsApi';
import { hashPhoneNumber } from './hash';
import { MatchedUser } from './types';

interface Props {
  onSelectUser: (user: MatchedUser) => void;
}

export function FindByNumber({ onSelectUser }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Enter a valid phone number with country code (e.g. +1234567890)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Try direct phone lookup first
      const direct = await contactsApi.lookupByPhone(normalized).catch(() => null);
      if (direct?.user) {
        onSelectUser(direct.user);
        return;
      }

      // 2. Fall back to SHA-256 hash match
      const hash = await hashPhoneNumber(normalized);
      const res = await contactsApi.matchContacts([hash]);
      if (res.users.length > 0) {
        onSelectUser(res.users[0]);
      } else {
        setError('No user found with this phone number on Chatterly');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md }}>
      <Text style={[typography.bodyBold, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
        Find by Phone Number
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+1234567890"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary,
          }}
        />
        <Pressable
          onPress={handleSearch}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Search</Text>
          )}
        </Pressable>
      </View>
      {error && (
        <Text style={{ color: colors.danger, fontSize: 12, marginTop: spacing.xs }}>{error}</Text>
      )}
    </View>
  );
}
