import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../../theme';

function ShimmerBase({ style }: { style?: ViewStyle }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.border, borderRadius: radius.sm },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonLine({
  width = '100%',
  height = 14,
}: {
  width?: number | string;
  height?: number;
}) {
  return <ShimmerBase style={{ width: width as number, height }} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonLine width="60%" height={18} />
        <SkeletonLine width={64} height={22} />
      </View>
      <SkeletonLine width="90%" />
      <SkeletonLine width="40%" />
      <View style={styles.cardFooter}>
        <SkeletonLine width={80} height={12} />
        <SkeletonLine width={80} height={12} />
      </View>
    </View>
  );
}

export function SkeletonCode() {
  return (
    <View style={styles.code}>
      <SkeletonLine width="30%" height={12} />
      <SkeletonLine width="80%" height={12} />
      <SkeletonLine width="65%" height={12} />
      <SkeletonLine width="90%" height={12} />
      <SkeletonLine width="50%" height={12} />
      <SkeletonLine width="75%" height={12} />
      <SkeletonLine width="40%" height={12} />
      <SkeletonLine width="85%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  code: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
});
