import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth';
import { useToastStore } from '../../src/stores/toast';
import { Button, FadeInView } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { formatDate } from '../../src/utils/format';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const toast = useToastStore((s) => s.show);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to logout?')) return;
      doLogout();
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const doLogout = () => {
    toast('info', 'You have been logged out');
    logout();
  };

  if (!user) return null;

  return (
    <FadeInView duration={300} style={styles.container}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={48} color={colors.primary} />
      </View>
      <Text style={styles.name}>{user.username}</Text>
      <Text style={styles.email}>{user.email}</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member since</Text>
          <Text style={styles.infoValue}>{formatDate(user.created_at)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>User ID</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {user.id.slice(0, 8)}...
          </Text>
        </View>
      </View>

      <View style={styles.logoutContainer}>
        <Button title="Logout" variant="danger" onPress={handleLogout} fullWidth />
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
  },
  email: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  infoCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
  },
  infoValue: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  logoutContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: spacing.xxl,
  },
});
