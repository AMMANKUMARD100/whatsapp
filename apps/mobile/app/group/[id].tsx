import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/store';
import { Avatar } from '../../src/features/chat/components/Avatar';
import { friendlyError } from '../../src/features/chat/utils';
import { groupsApi, type GroupDetails, type GroupMember } from '../../src/features/groups/groupsApi';

export default function GroupDetailsScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { user } = useAuthStore();
  const me = user?.id;

  const [details, setDetails] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await groupsApi.getDetails(chatId);
      setDetails(res);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [chatId]);

  const handlePickIcon = async () => {
    if (details?.myRole !== 'admin') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      try {
        await groupsApi.uploadIcon(chatId, res.assets[0].base64);
        await load();
      } catch (err) {
        setError(friendlyError(err));
      }
    }
  };

  const handleLeave = async () => {
    if (!me) return;
    try {
      await groupsApi.removeOrLeave(chatId, me);
      router.replace('/(tabs)');
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  if (loading && !details) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
        <Pressable onPress={handlePickIcon}>
          <Avatar name={details?.name || 'Group'} uri={details?.iconUrl} size={90} />
          {details?.myRole === 'admin' && (
            <Text style={{ color: colors.primary, fontSize: 13, marginTop: spacing.xs, fontWeight: '600' }}>
              Change Icon
            </Text>
          )}
        </Pressable>
        <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.md }]}>
          {details?.name}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Group · {details?.members.length} members
        </Text>
      </View>

      {error && (
        <Text style={{ color: colors.danger, textAlign: 'center', marginBottom: spacing.md }}>
          {error}
        </Text>
      )}

      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
        MEMBERS
      </Text>

      {details?.members.map((member) => (
        <Pressable
          key={member.userId}
          onPress={() => {
            if (details.myRole === 'admin' && member.userId !== me) {
              setSelectedMember(member);
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.sm,
          }}
        >
          <Avatar name={member.name} uri={member.avatarUrl} size={44} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>
              {member.name} {member.userId === me && '(You)'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{member.about}</Text>
          </View>
          {member.role === 'admin' && (
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Admin</Text>
            </View>
          )}
        </Pressable>
      ))}

      <Pressable
        onPress={handleLeave}
        style={{
          marginTop: spacing.xxl,
          padding: spacing.md,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>Exit group</Text>
      </Pressable>

      <Modal transparent visible={!!selectedMember} animationType="fade" onRequestClose={() => setSelectedMember(null)}>
        <Pressable
          onPress={() => setSelectedMember(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
        >
          {selectedMember && (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, minWidth: 250, overflow: 'hidden' }}>
              <Pressable
                onPress={async () => {
                  const member = selectedMember;
                  setSelectedMember(null);
                  try {
                    const nextRole = member.role === 'admin' ? 'member' : 'admin';
                    setDetails(await groupsApi.setRole(chatId, member.userId, nextRole));
                  } catch (err) {
                    setError(friendlyError(err));
                  }
                }}
                style={{ padding: spacing.lg }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                  {selectedMember.role === 'admin' ? 'Dismiss as admin' : 'Make group admin'}
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const member = selectedMember;
                  setSelectedMember(null);
                  try {
                    await groupsApi.removeOrLeave(chatId, member.userId);
                    await load();
                  } catch (err) {
                    setError(friendlyError(err));
                  }
                }}
                style={{ padding: spacing.lg }}
              >
                <Text style={{ color: colors.danger, fontSize: 16 }}>Remove {selectedMember.name}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
