import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../src/core/theme/ThemeProvider';

export default function CallsTabScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📞</Text>
      <Text style={[typography.title, { color: colors.textPrimary, textAlign: 'center' }]}>
        Calls
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
        To call someone, open a chat and tap the phone or video icon.
      </Text>
    </View>
  );
}
