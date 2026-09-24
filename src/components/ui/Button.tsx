import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { colors, radius, spacing, fonts } from '../../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: colors.primaryDark, text: colors.text },
  secondary: { bg: colors.bgTertiary, text: colors.text },
  danger: { bg: colors.danger, text: colors.text },
  ghost: { bg: 'transparent', text: colors.primary },
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, fullWidth }: Props) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      scaleTo={0.96}
      style={[
        styles.btn,
        { backgroundColor: v.bg },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: v.text }]}>{title}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
});
