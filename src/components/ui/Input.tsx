import { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fonts } from '../../theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, secureTextEntry, ...rest }: Props) {
  const [hidden, setHidden] = useState(true);

  const toggleVisibility = useCallback(() => {
    setHidden((h) => !h);
  }, []);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View>
        <TextInput
          style={[styles.input, error && styles.inputError, secureTextEntry && styles.inputWithIcon, style]}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          secureTextEntry={secureTextEntry ? hidden : false}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable onPress={toggleVisibility} style={styles.eyeBtn} hitSlop={8}>
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: fonts.sizes.md,
    minHeight: 44,
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  inputError: {
    borderColor: colors.danger,
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: fonts.sizes.xs,
    marginTop: spacing.xs,
  },
});
