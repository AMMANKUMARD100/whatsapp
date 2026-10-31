import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { Avatar } from '../../src/features/chat/components/Avatar';
import { useChatStore } from '../../src/features/chat/store';
import { useContactsStore } from '../../src/features/contacts/store';
import { MatchedUser } from '../../src/features/contacts/types';

export default function NewGroupScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { registeredUsers } = useContactsStore();
  const { createGroup } = useChatStore();

  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please provide a group name');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Select at least 1 member');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const group = await createGroup(name.trim(), selectedIds);
      router.replace(`/chat/${group.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Group subject"
        placeholderTextColor={colors.textSecondary}
        maxLength={50}
        style={{
          backgroundColor: colors.surfaceAlt,
          color: colors.textPrimary,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          fontSize: 16,
          marginBottom: spacing.md,
        }}
      />

      {error && (
        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: spacing.sm }}>
          {error}
        </Text>
      )}

      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
        ADD MEMBERS ({selectedIds.length} selected)
      </Text>

      <FlatList
        data={registeredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);
          return (
            <Pressable
              onPress={() => toggleSelect(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.sm,
              }}
            >
              <Avatar name={item.name} uri={item.avatarUrl} size={42} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.about}</Text>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selected ? colors.primary : colors.textSecondary,
                  backgroundColor: selected ? colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected && <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        onPress={handleCreate}
        disabled={loading}
        style={{
          backgroundColor: colors.primary,
          borderRadius: radius.pill,
          paddingVertical: spacing.md,
          alignItems: 'center',
          marginTop: spacing.md,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 16 }}>Create Group</Text>
        )}
      </Pressable>
    </View>
  );
}
