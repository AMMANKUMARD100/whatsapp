import React from 'react';
import { Text, View } from 'react-native';
import { MessageStatus } from '../../../core/services/types';
import { useTheme } from '../../../core/theme/ThemeProvider';

interface Props {
  status: MessageStatus;
}

export function StatusTicks({ status }: Props) {
  const { colors } = useTheme();

  if (status === 'sending') {
    return <Text style={{ fontSize: 11, color: colors.textSecondary }}>🕒</Text>;
  }

  if (status === 'failed') {
    return <Text style={{ fontSize: 11, color: colors.danger }}>⚠️</Text>;
  }

  if (status === 'sent') {
    return <Text style={{ fontSize: 11, color: colors.textSecondary }}>✓</Text>;
  }

  if (status === 'delivered') {
    return <Text style={{ fontSize: 11, color: colors.textSecondary }}>✓✓</Text>;
  }

  if (status === 'read') {
    return <Text style={{ fontSize: 11, color: colors.tickRead }}>✓✓</Text>;
  }

  return null;
}
