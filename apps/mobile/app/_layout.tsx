import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/core/theme/ThemeProvider';
import { useAuthStore } from '../src/features/auth/store';
import { useChatStore } from '../src/features/chat/store';
import { usePushNotifications } from '../src/features/push/usePushNotifications';

function AuthGate() {
  const { colors, isDark } = useTheme();
  const { status, user, init: initAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications();

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (status === 'loading') return;
    const first = segments[0] as string | undefined;
    const inAuth = first === 'login' || first === 'otp';

    if (status === 'signedOut') {
      if (!inAuth) router.replace('/login');
    } else if (!user?.name) {
      if (first !== 'profile') router.replace('/profile');
    } else if (inAuth) {
      router.replace('/(tabs)');
    }
  }, [status, user?.name, segments, router]);

  useEffect(() => {
    if (status === 'signedIn' && user?.name) void useChatStore.getState().init();
    else if (status === 'signedOut') void useChatStore.getState().reset();
  }, [status, user?.id, user?.name]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      useChatStore.getState().setAppActive(active);
      if (active) {
        void useChatStore.getState().init();
        void useChatStore.getState().sync();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="otp" options={{ title: 'Verify your number' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="contacts" options={{ title: 'Select contact' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="group/new" options={{ title: 'New group' }} />
        <Stack.Screen name="group/[id]" options={{ title: 'Group info' }} />
      </Stack>
      {status === 'loading' && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthGate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
