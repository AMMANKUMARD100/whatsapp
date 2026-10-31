import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  uri: string | null;
  caption?: string | null;
  onClose: () => void;
}

export function ImageViewerModal({ uri, caption, onClose }: Props) {
  if (!uri) return null;

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        {caption ? (
          <View style={styles.captionBox}>
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  captionBox: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 20,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});
