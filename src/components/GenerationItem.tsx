import { memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from './ui';
import { LanguageIcon } from './LanguageIcon';
import { useLanguagesStore } from '../stores/languages';
import { GenerationSummary } from '../types';
import { colors, fonts, spacing } from '../theme';
import { formatDateTime } from '../utils/format';

interface Props {
  generation: GenerationSummary;
  onPress: () => void;
  onMoveToFolder?: () => void;
  draggable?: boolean;
}

export const GenerationItem = memo(function GenerationItem({ generation, onPress, onMoveToFolder, draggable }: Props) {
  const languages = useLanguagesStore((s) => s.languages);
  const lang = languages.find((l) => l.id === generation.language_id);
  const langName = lang?.name || '';
  const [dragging, setDragging] = useState(false);

  const card = (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <LanguageIcon languageName={langName} size={22} />
        <Text style={styles.title} numberOfLines={1}>
          {generation.page_name}
        </Text>
        {onMoveToFolder && (
          <Pressable onPress={onMoveToFolder} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="folder-outline" size={14} color={colors.textTertiary} />
          </Pressable>
        )}
        <Badge
          text={generation.status}
          variant={generation.status === 'completed' ? 'success' : generation.status === 'failed' ? 'danger' : 'warning'}
        />
      </View>
      <View style={styles.footer}>
        {lang && <Text style={styles.langMeta}>{lang.display}</Text>}
        <Text style={styles.meta}>{generation.llm_model}</Text>
        {generation.folder && (
          <View style={styles.folderBadge}>
            <Ionicons name="folder-outline" size={10} color={colors.warning} />
            <Text style={styles.folderText}>{generation.folder}</Text>
          </View>
        )}
        <Text style={styles.meta}>{formatDateTime(generation.created_at)}</Text>
      </View>
    </Card>
  );

  if (Platform.OS === 'web' && draggable) {
    return (
      <div
        draggable
        onDragStart={(e: any) => {
          e.dataTransfer.setData('generationId', generation.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        style={{ opacity: dragging ? 0.5 : 1, cursor: dragging ? 'grabbing' : 'grab' }}
      >
        {card}
      </div>
    );
  }

  return card;
});

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '500',
    flex: 1,
  },
  iconBtn: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  langMeta: {
    color: colors.primary,
    fontSize: fonts.sizes.xs,
    fontWeight: '500',
  },
  meta: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgTertiary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  folderText: {
    color: colors.warning,
    fontSize: fonts.sizes.xs,
  },
});
