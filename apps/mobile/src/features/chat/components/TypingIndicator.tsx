import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../core/theme/ThemeProvider';

export function TypingIndicator() {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginHorizontal: spacing.md,
        marginVertical: 4,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' }}>
        typing…
      </Text>
    </View>
  );
}
