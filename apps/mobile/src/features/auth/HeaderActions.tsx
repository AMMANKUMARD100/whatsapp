import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../core/theme/ThemeProvider';

export function HeaderActions() {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable onPress={() => router.push('/contacts')} style={{ padding: spacing.sm }}>
        <Text style={{ fontSize: 20 }}>🔍</Text>
      </Pressable>
    </View>
  );
}
