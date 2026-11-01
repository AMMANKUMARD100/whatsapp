import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
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
const STORY_DURATION_MS = 10_000; // 10 seconds for text and photo statuses

interface UserStatusGroup {
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  stories: StatusItem[]; // chronological (oldest -> newest)
  latestAt: number;
  hasUnviewed: boolean;
}

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

  // Story player state: which person (groupIdx) and which story of that person (storyIdx)
  const [viewerPos, setViewerPos] = useState<{ groupIdx: number; storyIdx: number } | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Group statuses by user (one row per contact, stories ordered oldest -> newest)
  const { myGroup, contactGroups, allPlayableGroups } = useMemo(() => {
    const byUser = new Map<string, UserStatusGroup>();
    const chronological = [...statuses].sort((a, b) => a.createdAt - b.createdAt);

    for (const s of chronological) {
      const existing = byUser.get(s.userId);
      if (existing) {
        existing.stories.push(s);
        existing.latestAt = Math.max(existing.latestAt, s.createdAt);
        if (!s.viewedByMe && s.userId !== me?.id) existing.hasUnviewed = true;
      } else {
        byUser.set(s.userId, {
          userId: s.userId,
          userName: s.userId === me?.id ? 'My status' : s.userName,
          userAvatarUrl: s.userAvatarUrl,
          stories: [s],
          latestAt: s.createdAt,
          hasUnviewed: !s.viewedByMe && s.userId !== me?.id,
        });
      }
    }

    const mine = me?.id ? byUser.get(me.id) ?? null : null;
    if (me?.id) byUser.delete(me.id);

    const others = [...byUser.values()].sort((a, b) => b.latestAt - a.latestAt);
    const playable = [...(mine ? [mine] : []), ...others];
    return { myGroup: mine, contactGroups: others, allPlayableGroups: playable };
  }, [statuses, me?.id]);

  const activeGroup = viewerPos ? allPlayableGroups[viewerPos.groupIdx] : undefined;
  const activeStory = activeGroup ? activeGroup.stories[viewerPos!.storyIdx] : undefined;

  const clearStoryTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();
  }, [progressAnim]);

  // Move to the next status of the current person, or the first status of the next person
  const goNextStory = useCallback(() => {
    clearStoryTimer();
    setViewerPos((curr) => {
      if (!curr) return null;
      const group = allPlayableGroups[curr.groupIdx];
      if (!group) return null;

      if (curr.storyIdx + 1 < group.stories.length) {
        return { groupIdx: curr.groupIdx, storyIdx: curr.storyIdx + 1 };
      }
      if (curr.groupIdx + 1 < allPlayableGroups.length) {
        return { groupIdx: curr.groupIdx + 1, storyIdx: 0 };
      }
      return null; // All statuses finished
    });
  }, [allPlayableGroups, clearStoryTimer]);

  // Move to the previous status (or previous person's last status)
  const goPrevStory = useCallback(() => {
    clearStoryTimer();
    setViewerPos((curr) => {
      if (!curr) return null;
      if (curr.storyIdx > 0) {
        return { groupIdx: curr.groupIdx, storyIdx: curr.storyIdx - 1 };
      }
      if (curr.groupIdx > 0) {
        const prevGroup = allPlayableGroups[curr.groupIdx - 1];
        return { groupIdx: curr.groupIdx - 1, storyIdx: Math.max(0, prevGroup.stories.length - 1) };
      }
      return { groupIdx: 0, storyIdx: 0 };
    });
  }, [allPlayableGroups, clearStoryTimer]);

  // Start the 10-second timer whenever activeStory changes (for text/image stories)
  useEffect(() => {
    clearStoryTimer();
    if (!activeStory) return;

    progressAnim.setValue(0);

    // Mark as viewed on server
    if (activeStory.userId !== me?.id && !activeStory.viewedByMe) {
      statusApi.markViewed(activeStory.id).then(load).catch(() => undefined);
    }

    // For text and photo statuses, run the 10-second timer automatically.
    // For video statuses, the <Video onPlaybackStatusUpdate> drives progress and completion.
    if (activeStory.mediaKind !== 'video') {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: STORY_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      timerRef.current = setTimeout(() => {
        goNextStory();
      }, STORY_DURATION_MS);
    }

    return clearStoryTimer;
  }, [activeStory, me?.id, clearStoryTimer, goNextStory, load, progressAnim]);

  const handleVideoStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.durationMillis && status.durationMillis > 0) {
      progressAnim.setValue(Math.min(1, status.positionMillis / status.durationMillis));
    }
    if (status.didJustFinish) {
      goNextStory();
    }
  };

  const openPersonStories = (userId: string) => {
    const groupIdx = allPlayableGroups.findIndex((g) => g.userId === userId);
    if (groupIdx < 0) return;
    const group = allPlayableGroups[groupIdx];
    // Start at the first unviewed status of that person, or 0 if all viewed
    const firstUnviewed = group.stories.findIndex((s) => !s.viewedByMe && s.userId !== me?.id);
    setViewerPos({ groupIdx, storyIdx: firstUnviewed >= 0 ? firstUnviewed : 0 });
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={contactGroups}
        keyExtractor={(g) => g.userId}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg }}>
            {/* My Status Row (tap to view all my statuses if I have any, otherwise open composer) */}
            <Pressable
              onPress={() => (myGroup ? openPersonStories(myGroup.userId) : openTextComposer())}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
              <View
                style={{
                  padding: 2,
                  borderRadius: 28,
                  borderWidth: myGroup ? 2 : 0,
                  borderColor: colors.primary,
                }}
              >
                <Avatar name={me?.name ?? 'Me'} uri={assetUrl(me?.avatarUrl)} size={48} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.heading, { color: colors.textPrimary }]}>My status</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {myGroup
                    ? `${myGroup.stories.length} update${myGroup.stories.length > 1 ? 's' : ''} · Last at ${formatTime(myGroup.latestAt)} (tap to view)`
                    : 'Tap Photo, Video, or Text below to add a status'}
                </Text>
              </View>
            </Pressable>

            {/* Quick buttons to add Text, Photo, or Video Status */}
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

            {error && !composerOpen && <Text style={{ color: colors.danger, marginTop: spacing.sm }}>{error}</Text>}

            <Text style={[typography.heading, { color: colors.primary, marginTop: spacing.lg }]}>Recent updates</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openPersonStories(item.userId)}
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
                borderWidth: 2.5,
                borderColor: item.hasUnviewed ? colors.primary : colors.border,
              }}
            >
              <Avatar name={item.userName} uri={assetUrl(item.userAvatarUrl)} size={46} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 16 }}>{item.userName}</Text>
              <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>
                {item.stories.length} status{item.stories.length > 1 ? 'es' : ''} · Today at {formatTime(item.latestAt)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !myGroup ? (
            <EmptyState title="No status updates" subtitle="Tap Photo, Video, or Text above to post a story." />
          ) : null
        }
      />

      {/* Composer modal */}
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

      {/* WhatsApp-style Multi-Story Viewer Modal */}
      <Modal
        visible={!!activeGroup && !!activeStory}
        transparent
        animationType="fade"
        onRequestClose={() => {
          clearStoryTimer();
          setViewerPos(null);
        }}
      >
        {activeGroup && activeStory && (
          <Pressable
            onPress={(evt) => {
              const screenWidth = Dimensions.get('window').width;
              const tapX = evt.nativeEvent.locationX;
              // Tap left 25% of screen -> previous story; tap anywhere else -> next story immediately
              if (tapX < screenWidth * 0.25) {
                goPrevStory();
              } else {
                goNextStory();
              }
            }}
            style={{
              flex: 1,
              backgroundColor: activeStory.mediaUrl ? '#000' : activeStory.bgColor,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Top segmented progress bars + Header */}
            <View style={{ position: 'absolute', top: 36, left: 12, right: 12, zIndex: 20 }}>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 12 }}>
                {activeGroup.stories.map((s, idx) => {
                  const isPast = idx < viewerPos!.storyIdx;
                  const isCurrent = idx === viewerPos!.storyIdx;
                  return (
                    <View
                      key={s.id}
                      style={{
                        flex: 1,
                        height: 3,
                        backgroundColor: 'rgba(255,255,255,0.35)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      {isPast && <View style={{ flex: 1, backgroundColor: '#fff' }} />}
                      {isCurrent && (
                        <Animated.View
                          style={{
                            height: '100%',
                            backgroundColor: '#fff',
                            width: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Contact avatar, name, timestamp, and close button */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Avatar name={activeGroup.userName} uri={assetUrl(activeGroup.userAvatarUrl)} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{activeGroup.userName}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                    {formatTime(activeStory.createdAt)} · { viewerPos!.storyIdx + 1 }/{ activeGroup.stories.length }
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    clearStoryTimer();
                    setViewerPos(null);
                  }}
                  hitSlop={12}
                  style={{ padding: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Story Body: Video, Image, or Text */}
            {activeStory.mediaUrl && activeStory.mediaKind === 'video' && (
              <Video
                key={activeStory.id}
                source={{ uri: assetUrl(activeStory.mediaUrl) ?? activeStory.mediaUrl }}
                style={{ width: '100%', height: '72%' }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                onPlaybackStatusUpdate={handleVideoStatus}
              />
            )}

            {activeStory.mediaUrl && activeStory.mediaKind !== 'video' && (
              <Image
                key={activeStory.id}
                source={{ uri: assetUrl(activeStory.mediaUrl) ?? activeStory.mediaUrl }}
                resizeMode="contain"
                style={{ width: '100%', height: '72%' }}
              />
            )}

            {activeStory.caption && (
              <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: activeStory.mediaUrl ? 18 : 28,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}
                >
                  {activeStory.caption}
                </Text>
              </View>
            )}

            {/* Footer view count */}
            <Text style={{ position: 'absolute', bottom: 28, color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              👁 {activeStory.viewCount} views · Tap to advance
            </Text>
          </Pressable>
        )}
      </Modal>
    </View>
  );
}
