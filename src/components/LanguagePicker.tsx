import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguagesStore } from '../stores/languages';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function LanguagePicker({ selectedId, onSelect }: Props) {
  const { languages, fetch } = useLanguagesStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Language / Framework</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.list}>
          {languages.map((lang) => {
            const selected = lang.id === selectedId;
            return (
              <Pressable
                key={lang.id}
                onPress={() => onSelect(lang.id)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                {selected && (
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                )}
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {lang.display}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  list: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark + '22',
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
  },
  chipTextSelected: {
    color: colors.primary,
  },
});
