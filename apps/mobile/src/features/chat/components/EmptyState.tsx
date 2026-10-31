import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../core/theme/ThemeProvider';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: Props) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Text style={[typography.heading, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.primary,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
