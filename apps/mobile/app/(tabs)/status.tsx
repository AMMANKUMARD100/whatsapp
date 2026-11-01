import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { assetUrl } from '../../src/core/api/assetUrl';
import { LocalMediaUpload } from '../../src/core/services/types';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/store';
import { Avatar } from '../../src/features/chat/components/Avatar';
import { EmptyState } from '../../src/features/chat/components/EmptyState';
import { uploadMediaAttachment } from '../../src/features/chat/mediaApi';
import { formatTime, friendlyError } from '../../src/features/chat/utils';
import { statusApi, StatusItem } from '../../src/features/status/statusApi';

const BG_PALETTE = ['#0E8A7D', '#7C4DFF', '#D81B60', '#E67E22', '#2980B9'];

export default function StatusTab() {
  const { colors, spacing, radius, typography } = useTheme();
  const me = useAuthStore((s) => s.user);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [pickedMedia, setPickedMedia] = useState<LocalMediaUpload | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<StatusItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await statusApi.list();
      setStatuses(res.statuses);
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openTextComposer = () => {
    setPickedMedia(null);
    setCaption('');
    setError(null);
    setComposerOpen(true);
  };

  const pickStatusMedia = async (wantVideo: boolean) => {
    setError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: wantVideo ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      const asset = res.assets?.[0];
      if (res.canceled || !asset) return;

      const isVideo = wantVideo || asset.type === 'video' || (asset.mimeType?.startsWith('video/') ?? false);
      setPickedMedia({
        uri: asset.uri,
        kind: isVideo ? 'video' : 'image',
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        sizeBytes: asset.fileSize,
        fileName: asset.fileName || (isVideo ? `status-${Date.now()}.mp4` : `status-${Date.now()}.jpg`),
        width: asset.width,
        height: asset.height,
        durationMs: asset.duration ?? undefined,
      });
      setComposerOpen(true);
    } catch {
      setError('Could not open your photo/video library.');
    }
  };

  const postStatus = async () => {
    if (!caption.trim() && !pickedMedia) {
      setError('Type a status or attach a photo/video');
      return;
    }
    setPosting(true);
    setError(null);
    try {
      let mediaId: string | undefined;
      if (pickedMedia) {
        const uploaded = await uploadMediaAttachment(pickedMedia);
        mediaId = uploaded.id;
      }
      await statusApi.create({
        caption: caption.trim() || undefined,
        bgColor: BG_PALETTE[bgIndex],
        mediaId,
      });
      setCaption('');
      setPickedMedia(null);
      setComposerOpen(false);
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPosting(false);
    }
  };

  const openStory = (item: StatusItem) => {
    setViewing(item);
    if (item.userId !== me?.id && !item.viewedByMe) {
      statusApi.markViewed(item.id).then(load).catch(() => undefined);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={statuses}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar name={me?.name ?? 'Me'} uri={assetUrl(me?.avatarUrl)} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>My status</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Share text, photos, or videos that disappear in 24 hours
                </Text>
              </View>
            </View>

            {/* Action buttons for Text, Photo, and Video Status */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable
                onPress={openTextComposer}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceAlt,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>✏️ Text</Text>
              </Pressable>

              <Pressable
                onPress={() => void pickStatusMedia(false)}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>📷 Photo</Text>
              </Pressable>

              <Pressable
                onPress={() => void pickStatusMedia(true)}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>🎥 Video</Text>
              </Pressable>
            </View>

            {error && !composerOpen && (
              <Text style={{ color: colors.danger, marginTop: spacing.sm }}>{error}</Text>
            )}

            <Text style={[typography.heading, { color: colors.primary, marginTop: spacing.lg }]}>
              Recent updates
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mediaLabel =
            item.mediaKind === 'video' ? '🎥 Video' : item.mediaKind === 'image' ? '📷 Photo' : '✏️ Text';
          return (
            <Pressable
              onPress={() => openStory(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
              }}
            >
              <View
                style={{
                  padding: 2,
                  borderRadius: 28,
                  borderWidth: 2,
                  borderColor: item.viewedByMe ? colors.border : colors.primary,
                }}
              >
                <Avatar name={item.userName} uri={assetUrl(item.userAvatarUrl)} size={46} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>
                  {item.userId === me?.id ? 'You' : item.userName}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {mediaLabel}
                  {item.caption ? ` · ${item.caption}` : ''} · {formatTime(item.createdAt)} · {item.viewCount} views
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState title="No status updates" subtitle="Tap Photo, Video, or Text above to post a story." />}
      />

      {/* Composer modal (supports Text, Image preview, or Video preview + caption) */}
      <Modal visible={composerOpen} animationType="slide" onRequestClose={() => !posting && setComposerOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: pickedMedia ? '#000' : BG_PALETTE[bgIndex],
            justifyContent: 'center',
            padding: spacing.xl,
          }}
        >
          {pickedMedia?.kind === 'image' && (
            <Image
              source={{ uri: pickedMedia.uri }}
              resizeMode="contain"
              style={{ width: '100%', height: '58%', marginBottom: spacing.md }}
            />
          )}

          {pickedMedia?.kind === 'video' && (
            <Video
              source={{ uri: pickedMedia.uri }}
              style={{ width: '100%', height: '58%', marginBottom: spacing.md }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              isLooping
            />
          )}

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={pickedMedia ? 'Add a caption…' : 'Type a status…'}
            placeholderTextColor="rgba(255,255,255,0.65)"
            multiline
            maxLength={500}
            style={{
              color: '#fff',
              fontSize: pickedMedia ? 18 : 26,
              fontWeight: '700',
              textAlign: 'center',
              backgroundColor: pickedMedia ? 'rgba(255,255,255,0.12)' : 'transparent',
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          />

          {error && <Text style={{ color: '#ff6b6b', textAlign: 'center', marginTop: spacing.sm }}>{error}</Text>}

          <View
            style={{
              position: 'absolute',
              bottom: 36,
              left: 20,
              right: 20,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {!pickedMedia && (
                <Pressable onPress={() => setBgIndex((i) => (i + 1) % BG_PALETTE.length)}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>🎨 Color</Text>
                </Pressable>
              )}
              <Pressable onPress={() => void pickStatusMedia(false)} disabled={posting}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>📷 Photo</Text>
              </Pressable>
              <Pressable onPress={() => void pickStatusMedia(true)} disabled={posting}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>🎥 Video</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
              <Pressable
                onPress={() => {
                  setPickedMedia(null);
                  setComposerOpen(false);
                }}
                disabled={posting}
              >
                <Text style={{ color: '#fff', fontSize: 16 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={postStatus}
                disabled={posting}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                }}
              >
                {posting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Post ➤</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen Story Viewer Modal (plays Videos & shows Photos + Captions) */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        {viewing && (
          <View
            style={{
              flex: 1,
              backgroundColor: viewing.mediaUrl ? '#000' : viewing.bgColor,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.lg,
            }}
          >
            <Pressable
              onPress={() => setViewing(null)}
              style={{ position: 'absolute', top: 44, right: 20, zIndex: 10, padding: 10 }}
            >
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>✕</Text>
            </Pressable>

            {viewing.mediaUrl && viewing.mediaKind === 'video' && (
              <Video
                source={{ uri: assetUrl(viewing.mediaUrl) ?? viewing.mediaUrl }}
                style={{ width: '100%', height: '72%' }}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
              />
            )}

            {viewing.mediaUrl && viewing.mediaKind !== 'video' && (
              <Image
                source={{ uri: assetUrl(viewing.mediaUrl) ?? viewing.mediaUrl }}
                resizeMode="contain"
                style={{ width: '100%', height: '72%' }}
              />
            )}

            {viewing.caption && (
              <Text
                style={{
                  color: '#fff',
                  fontSize: viewing.mediaUrl ? 18 : 26,
                  fontWeight: '700',
                  textAlign: 'center',
                  marginTop: spacing.md,
                }}
              >
                {viewing.caption}
              </Text>
            )}

            <Text style={{ position: 'absolute', bottom: 32, color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              {viewing.userName} · {viewing.viewCount} views
            </Text>
          </View>
        )}
      </Modal>
    </View>
  );
}
