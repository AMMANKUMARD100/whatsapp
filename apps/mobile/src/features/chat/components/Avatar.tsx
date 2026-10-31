import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../core/theme/ThemeProvider';

interface Props {
  name: string;
  uri?: string | null;
  size?: number;
  color?: string;
}

export function Avatar({ name, uri, size = 44, color }: Props) {
  const { colors, radius } = useTheme();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt }}
      />
    );
  }

  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const bg = color || colors.primary;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.onPrimary, fontSize: size * 0.4, fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
}
