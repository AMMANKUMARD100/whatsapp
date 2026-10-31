import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { formatDuration } from '../utils';

interface Props {
  url: string;
  durationMs?: number | null;
  isMine: boolean;
}

export function VoiceNotePlayer({ url, durationMs, isMine }: Props) {
  const { colors, spacing } = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) void sound.unloadAsync();
    };
  }, [sound]);

  const togglePlay = async () => {
    try {
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPositionMs(status.positionMillis);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionMs(0);
              }
            }
          },
        );
        setSound(newSound);
        setIsPlaying(true);
      } else {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 }}>
      <Pressable onPress={togglePlay} style={{ padding: 4 }}>
        <Text style={{ fontSize: 20 }}>{isPlaying ? '⏸️' : '▶️'}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={{ height: 4, backgroundColor: isMine ? '#A8D5BA' : '#D1D7DB', borderRadius: 2 }} />
      </View>
      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
        {formatDuration(isPlaying ? positionMs : durationMs ?? 0)}
      </Text>
    </View>
  );
}
