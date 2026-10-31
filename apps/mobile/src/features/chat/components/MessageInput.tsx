import React, { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LocalMediaUpload } from '../../../core/services/types';
import { useTheme } from '../../../core/theme/ThemeProvider';

interface Props {
  replyPreview?: { name: string; text: string };
  onCancelReply: () => void;
  onTextChange?: (text: string) => void;
  onError?: (err: string) => void;
  onSend: (text: string) => void;
  onSendMedia: (file: LocalMediaUpload, caption?: string) => void;
}

export function MessageInput({
  replyPreview,
  onCancelReply,
  onTextChange,
  onError,
  onSend,
  onSendMedia,
}: Props) {
  const { colors, spacing, radius } = useTheme();
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const webMediaRecorderRef = useRef<any>(null);
  const webAudioChunksRef = useRef<Blob[]>([]);
  const webAudioStartTimeRef = useRef<number>(0);

  const handleChangeText = (val: string) => {
    setText(val);
    onTextChange?.(val);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    onTextChange?.('');
  };

  const pickImage = async () => {
    setShowAttach(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onSendMedia({
        uri: asset.uri,
        kind: 'image',
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || 'photo.jpg',
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.fileSize,
      });
    }
  };

  const pickDocument = async () => {
    setShowAttach(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onSendMedia({
        uri: asset.uri,
        kind: 'document',
        mimeType: asset.mimeType || 'application/octet-stream',
        fileName: asset.name,
        sizeBytes: asset.size,
      });
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        if (!navigator?.mediaDevices?.getUserMedia) {
          onError?.('Microphone not supported on this browser');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new (window as any).MediaRecorder(stream);
        webMediaRecorderRef.current = mediaRecorder;
        webAudioChunksRef.current = [];
        webAudioStartTimeRef.current = Date.now();

        mediaRecorder.ondataavailable = (e: any) => {
          if (e.data && e.data.size > 0) {
            webAudioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        return;
      }

      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        onError?.('Microphone permission required for voice notes');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
    } catch {
      onError?.('Could not start recording');
    }
  };

  const stopRecording = async (send: boolean) => {
    if (Platform.OS === 'web') {
      const mediaRecorder = webMediaRecorderRef.current;
      if (!mediaRecorder) return;
      setIsRecording(false);

      mediaRecorder.onstop = () => {
        try {
          if (send && webAudioChunksRef.current.length > 0) {
            let mimeType = (mediaRecorder.mimeType || 'audio/webm').split(';')[0];
            if (!mimeType) mimeType = 'audio/webm';
            const audioBlob = new Blob(webAudioChunksRef.current, { type: mimeType });
            const uri = URL.createObjectURL(audioBlob);
            const durationMs = Date.now() - webAudioStartTimeRef.current;
            const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';

            onSendMedia({
              uri,
              kind: 'audio',
              mimeType,
              fileName: `voicenote.${ext}`,
              sizeBytes: audioBlob.size,
              durationMs,
            });
          }
        } finally {
          mediaRecorder.stream?.getTracks?.().forEach((t: any) => t.stop());
          webMediaRecorderRef.current = null;
          webAudioChunksRef.current = [];
        }
      };

      try {
        mediaRecorder.stop();
      } catch {
        // ignore
      }
      return;
    }

    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      if (send) {
        const uri = recording.getURI();
        const status = await recording.getStatusAsync();
        if (uri) {
          onSendMedia({
            uri,
            kind: 'audio',
            mimeType: 'audio/m4a',
            fileName: 'voicenote.m4a',
            durationMs: status.durationMillis,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setRecording(null);
    }
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
      {replyPreview && (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surfaceAlt }}>
          <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.sm }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{replyPreview.name}</Text>
            <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary }}>{replyPreview.text}</Text>
          </View>
          <Pressable onPress={onCancelReply} style={{ padding: spacing.xs }}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>✕</Text>
          </Pressable>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm }}>
        <Pressable onPress={() => setShowAttach(true)} style={{ padding: spacing.xs }}>
          <Text style={{ fontSize: 22 }}>📎</Text>
        </Pressable>

        {isRecording ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm }}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>🔴 Recording voice note…</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => stopRecording(false)}
                style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => stopRecording(true)}
                style={{
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Send</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <TextInput
            value={text}
            onChangeText={handleChangeText}
            placeholder="Message"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              flex: 1,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              maxHeight: 100,
              color: colors.textPrimary,
              fontSize: 15,
            }}
          />
        )}

        {text.trim() ? (
          <Pressable
            onPress={handleSend}
            style={{
              backgroundColor: colors.primary,
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.onPrimary, fontSize: 18 }}>➤</Text>
          </Pressable>
        ) : Platform.OS === 'web' ? (
          <Pressable
            onPress={isRecording ? () => stopRecording(true) : startRecording}
            style={{
              backgroundColor: isRecording ? colors.danger : colors.primary,
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.onPrimary, fontSize: 18 }}>{isRecording ? '⏹' : '🎤'}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPressIn={startRecording}
            onPressOut={() => stopRecording(true)}
            style={{
              backgroundColor: isRecording ? colors.danger : colors.primary,
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.onPrimary, fontSize: 18 }}>🎤</Text>
          </Pressable>
        )}
      </View>

      <Modal transparent visible={showAttach} animationType="fade" onRequestClose={() => setShowAttach(false)}>
        <Pressable onPress={() => setShowAttach(false)} style={styles.modalBg}>
          <View style={[styles.attachSheet, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
            <Pressable onPress={pickImage} style={styles.attachOption}>
              <Text style={{ fontSize: 24, marginRight: spacing.md }}>🖼️</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Photo & Video</Text>
            </Pressable>
            <Pressable onPress={pickDocument} style={styles.attachOption}>
              <Text style={{ fontSize: 24, marginRight: spacing.md }}>📄</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Document</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  attachSheet: {
    padding: 16,
    gap: 16,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
