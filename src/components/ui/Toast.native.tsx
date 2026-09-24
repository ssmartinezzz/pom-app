import { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore, ToastType } from '../../stores/toast';
import { colors, fonts, radius, spacing } from '../../theme';

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

const COLORS: Record<ToastType, string> = {
  success: colors.success,
  error: colors.danger,
  warning: colors.warning,
  info: colors.info,
};

function ToastItem({ id, type, text }: { id: string; type: ToastType; text: string }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, damping: 18, useNativeDriver: true }).start();
  }, [translateY]);

  const handleDismiss = useCallback(() => {
    Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }).start(() => {
      dismiss(id);
    });
  }, [dismiss, id, translateY]);

  return (
    <Animated.View
      style={[styles.toast, { borderLeftColor: COLORS[type], transform: [{ translateY }] }]}
    >
      <Ionicons name={ICONS[type]} size={20} color={COLORS[type]} style={styles.icon} />
      <Text style={styles.text} numberOfLines={3}>
        {text}
      </Text>
      <Pressable onPress={handleDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastContainer() {
  const messages = useToastStore((s) => s.messages);
  const insets = useSafeAreaInsets();

  if (messages.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + spacing.sm, pointerEvents: 'box-none' }]}>
      {messages.map((m) => (
        <ToastItem key={m.id} id={m.id} type={m.type} text={m.text} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    elevation: 6,
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.sizes.sm,
  },
});
