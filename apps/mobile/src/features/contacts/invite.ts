import { Share } from 'react-native';

export async function shareInviteLink(phone?: string) {
  try {
    await Share.share({
      message: 'Hey! Join me on Chatterly for end-to-end encrypted messaging: https://chatterly.app/download',
    });
  } catch {
    // ignore
  }
}
