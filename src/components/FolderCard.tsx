import { memo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui';
import { FolderSummary } from '../types';
import { colors, fonts, spacing } from '../theme';

interface Props {
  folder: FolderSummary;
  onPress: () => void;
  onRename?: (newName: string) => Promise<void>;
  onDelete?: () => void;
  onDropExtraction?: (extractionId: string) => void;
  onDropGeneration?: (generationId: string) => void;
}

export const FolderCard = memo(function FolderCard({ folder, onPress, onRename, onDelete, onDropExtraction, onDropGeneration }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const savingRef = useRef(false);

  const handleStartEdit = () => {
    setDraft(folder.folder);
    setEditing(true);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === folder.folder || !onRename) {
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
    <Card onPress={editing ? undefined : onPress} style={dragOver ? { ...styles.card, ...styles.cardDragOver } : styles.card}>
      <View style={styles.row}>
        <Ionicons name="folder-outline" size={20} color={dragOver ? colors.primary : colors.warning} />
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
              placeholder="Folder name..."
              placeholderTextColor={colors.textTertiary}
            />
            {saving && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
        ) : (
          <>
            <Text style={styles.name} numberOfLines={1}>{folder.folder}</Text>
            {onRename && (
              <Pressable onPress={handleStartEdit} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="pencil-outline" size={14} color={colors.textTertiary} />
              </Pressable>
            )}
          </>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{folder.extraction_count}</Text>
        </View>
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={14} color={colors.textTertiary} />
          </Pressable>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </Card>
  );

  if (Platform.OS === 'web' && (onDropExtraction || onDropGeneration)) {
    return (
      <div
        onDragOver={(e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
        onDragEnter={(e: any) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: any) => {
          e.preventDefault();
          setDragOver(false);
          const extractionId = e.dataTransfer.getData('extractionId');
          if (extractionId && onDropExtraction) { onDropExtraction(extractionId); return; }
          const generationId = e.dataTransfer.getData('generationId');
          if (generationId && onDropGeneration) onDropGeneration(generationId);
        }}
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
  cardDragOver: {
    borderColor: colors.primary,
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
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
  iconBtn: {
    padding: 4,
  },
  badge: {
    backgroundColor: colors.bgTertiary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
  },
});
