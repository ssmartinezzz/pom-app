import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth';
import { colors, fonts, spacing } from '../../src/theme';

function HeaderRight() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const handleLogout = () => {
    const doLogout = async () => {
      await logout();
      router.replace('/(auth)/login');
    };

    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to log out?')) return;
      doLogout();
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  return (
    <View style={styles.headerRight}>
      {user && (
        <Text style={styles.greeting} numberOfLines={1}>
          Hi, {user.username}
        </Text>
      )}
      <Pressable onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
        <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgSecondary },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600', fontSize: fonts.sizes.lg },
        headerRight: () => <HeaderRight />,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.md,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    maxWidth: 120,
  },
  logoutBtn: {
    padding: spacing.xs,
  },
});
