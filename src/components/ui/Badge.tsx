import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, fonts } from '../../theme';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface Props {
  text: string;
  variant?: Variant;
}

const variantColors: Record<Variant, { bg: string; text: string }> = {
  success: { bg: '#238636', text: colors.text },
  warning: { bg: '#9e6a03', text: colors.text },
  danger: { bg: '#da3633', text: colors.text },
  info: { bg: '#1f6feb', text: colors.text },
  default: { bg: colors.bgTertiary, text: colors.textSecondary },
};

export function Badge({ text, variant = 'default' }: Props) {
  const v = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
  },
});
