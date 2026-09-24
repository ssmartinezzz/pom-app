import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/stores/auth';
import { setOnUnauthorized } from '../src/api/client';
import { LoadingScreen, ToastContainer } from '../src/components/ui';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { colors } from '../src/theme';

export default function RootLayout() {
  const { user, isReady, init, clearSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearSession();
    });
  }, [clearSession]);

  useEffect(() => {
    if (!isReady) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, isReady, segments, router]);

  if (!isReady) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="project/[id]"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="extraction/[id]"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="generation/[id]"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="analysis/[id]"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
      </Stack>
      <ToastContainer />
    </ErrorBoundary>
  );
}
