import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { colors, radius, spacing } from '../../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, onPress, style }: Props) {
  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        style={[styles.card, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <Pressable style={[styles.card, style]}>{children}</Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
