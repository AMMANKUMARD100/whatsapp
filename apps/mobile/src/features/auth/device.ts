import { Platform } from 'react-native';

export function getDeviceInfo() {
  return {
    deviceId: `${Platform.OS}-${Math.random().toString(36).slice(2, 9)}`,
    platform: Platform.OS,
  };
}
