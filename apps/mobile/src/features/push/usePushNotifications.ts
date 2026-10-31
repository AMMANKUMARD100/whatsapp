import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../core/api/client';
import { useChatStore } from '../chat/store';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { chatId?: string } | undefined;
    const isSameOpenChat = data?.chatId && useChatStore.getState().openChatId === data.chatId;
    return {
      shouldShowAlert: !isSameOpenChat,
      shouldPlaySound: !isSameOpenChat,
      shouldSetBadge: false,
    };
  },
});

export function usePushNotifications() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function register() {
      if (!Device.isDevice) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0E8A7D',
        });
      }

      const token = (await Notifications.getDevicePushTokenAsync()).data;
      if (token) {
        await apiFetch('/me/push-token', { method: 'PUT', body: { pushToken: token } }).catch(() => undefined);
      }
    }

    void register();

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { chatId?: string; url?: string } | undefined;
      if (data?.chatId) {
        router.push(`/chat/${data.chatId}`);
      }
    });

    return () => {
      responseSubscription.remove();
    };
  }, [router]);
}
