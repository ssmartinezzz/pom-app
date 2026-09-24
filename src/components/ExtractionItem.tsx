import { memo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from './ui';
import { ExtractionSummary } from '../types';
import { colors, fonts, spacing } from '../theme';
import { formatDateTime, formatUrl } from '../utils/format';

interface Props {
  extraction: ExtractionSummary;
  onPress: () => void;
  onRename?: (newTitle: string) => Promise<void>;
  onMoveToFolder?: () => void;
  draggable?: boolean;
}

export const ExtractionItem = memo(function ExtractionItem({ extraction, onPress, onRename, onMoveToFolder, draggable }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const savingRef = useRef(false);

  const handleStartEdit = () => {
    setDraft(extraction.page_title || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === extraction.page_title || !onRename) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await onRename(trimmed);
    } catch {
      // error handled by caller
    } finally {
      savingRef.current = false;
      setSaving(false);
      setEditing(false);
    }
  };

  const card = (
    <Card onPress={editing ? undefined : onPress} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="scan-outline" size={18} color={colors.primary} />
        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              value={draft}
              onChangeText={setDraft}
              onBlur={handleSave}
              onSubmitEditing={handleSave}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              placeholder="Page name..."
              placeholderTextColor={colors.textTertiary}
            />
            {saving && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
        ) : (
          <>
            <Text style={styles.title} numberOfLines={1}>
              {extraction.page_title || 'Untitled'}
            </Text>
            {onRename && (
              <Pressable onPress={handleStartEdit} hitSlop={8} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={14} color={colors.textTertiary} />
              </Pressable>
            )}
            {onMoveToFolder && (
              <Pressable onPress={onMoveToFolder} hitSlop={8} style={styles.editBtn}>
                <Ionicons name="folder-outline" size={14} color={colors.textTertiary} />
              </Pressable>
            )}
          </>
        )}
        <Badge
          text={extraction.status}
          variant={extraction.status === 'completed' ? 'success' : extraction.status === 'failed' ? 'danger' : 'warning'}
        />
      </View>
      <Text style={styles.url} numberOfLines={1}>{formatUrl(extraction.url)}</Text>
      <View style={styles.footer}>
        <Text style={styles.meta}>{extraction.element_count} elements</Text>
        {extraction.folder && (
          <View style={styles.folderBadge}>
            <Ionicons name="folder-outline" size={10} color={colors.warning} />
            <Text style={styles.folderText}>{extraction.folder}</Text>
          </View>
        )}
        <Text style={styles.meta}>{formatDateTime(extraction.created_at)}</Text>
      </View>
    </Card>
  );

  if (Platform.OS === 'web' && draggable) {
    return (
      <div
        draggable
        onDragStart={(e: any) => {
          e.dataTransfer.setData('extractionId', extraction.id);
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
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '500',
    flex: 1,
  },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editInput: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '500',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  editBtn: {
    padding: 4,
  },
  url: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
