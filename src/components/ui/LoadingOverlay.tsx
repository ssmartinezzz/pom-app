import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SkeletonCard, SkeletonCode } from './Skeleton';
import { colors, fonts, spacing } from '../../theme';

interface Props {
  message?: string;
}

export function LoadingOverlay({ message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
}

export function LoadingScreen({ message }: Props) {
  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
}

export function LoadingSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

export function LoadingSkeletonCode() {
  return (
    <View style={styles.skeletonCode}>
      <SkeletonCode />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 17, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginTop: spacing.md,
  },
  skeletonList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonCode: {
    padding: spacing.md,
  },
});
