import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { Avatar } from '../../src/features/chat/components/Avatar';
import { statusApi, type StatusItem } from '../../src/features/status/statusApi';

const COLORS = ['#0E8A7D', '#202C33', '#7C4DFF', '#E5484D', '#E67E22'];

export default function StatusTabScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState(COLORS[0]);
  const [viewingStatus, setViewingStatus] = useState<StatusItem | null>(null);

  const load = async () => {
    try {
      const items = await statusApi.list();
      setStatuses(items);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handlePost = async () => {
    if (!caption.trim()) return;
    try {
      await statusApi.create({ caption: caption.trim(), bgColor });
      setCaption('');
      setShowCompose(false);
      await load();
    } catch {
      // ignore
    }
  };

  const openStatus = (s: StatusItem) => {
    setViewingStatus(s);
    if (!s.viewedByMe) {
      void statusApi.markViewed(s.id);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Pressable
        onPress={() => setShowCompose(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Avatar name="My Status" color={colors.primary} size={50} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>My Status</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Tap to add status update</Text>
        </View>
        <Text style={{ fontSize: 24, color: colors.primary }}>✏️</Text>
      </Pressable>

      <Text
        style={[
          typography.caption,
          { color: colors.textSecondary, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xs },
        ]}
      >
        RECENT UPDATES
      </Text>

      <FlatList
        data={statuses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openStatus(item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Avatar name={item.userName} uri={item.userAvatarUrl} size={50} color={item.bgColor} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>{item.userName}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
                {item.caption || 'Photo'}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              👁️ {item.viewCount}
            </Text>
          </Pressable>
        )}
      />

      <Modal visible={showCompose} animationType="slide">
        <View style={{ flex: 1, backgroundColor: bgColor, padding: spacing.xl, justifyContent: 'center' }}>
          <Pressable
            onPress={() => setShowCompose(false)}
            style={{ position: 'absolute', top: 50, right: 20, padding: 10 }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>✕</Text>
          </Pressable>

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Type a status…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            multiline
            autoFocus
            style={{
              color: '#FFFFFF',
              fontSize: 28,
              textAlign: 'center',
              fontWeight: '600',
            }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 40 }}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setBgColor(c)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: c,
                  borderWidth: 2,
                  borderColor: bgColor === c ? '#FFFFFF' : 'transparent',
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={handlePost}
            style={{
              marginTop: 40,
              backgroundColor: '#FFFFFF',
              alignSelf: 'center',
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: radius.pill,
            }}
          >
            <Text style={{ color: bgColor, fontWeight: '700', fontSize: 16 }}>Post</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={!!viewingStatus} animationType="fade" onRequestClose={() => setViewingStatus(null)}>
        {viewingStatus && (
          <Pressable
            onPress={() => setViewingStatus(null)}
            style={{ flex: 1, backgroundColor: viewingStatus.bgColor, padding: spacing.xl, justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 32, textAlign: 'center', fontWeight: '600' }}>
              {viewingStatus.caption}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 20 }}>
              Posted by {viewingStatus.userName}
            </Text>
          </Pressable>
        )}
      </Modal>
    </View>
  );
}
