import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from './ui';
import { AnalysisSummary } from '../types';
import { colors, fonts, spacing } from '../theme';
import { formatDateTime } from '../utils/format';

interface Props {
  analysis: AnalysisSummary;
  onPress: () => void;
  onDelete?: () => void;
}

export const AnalysisItem = memo(function AnalysisItem({ analysis, onPress, onDelete }: Props) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={18} color={colors.warning} />
        <Text style={styles.title} numberOfLines={1}>
          {analysis.page_name || analysis.page_type || 'Analysis'}
        </Text>
        {analysis.applied_at ? (
          <Badge text="Applied" variant="success" />
        ) : (
          <Badge text="AI" variant="warning" />
        )}
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        )}
      </View>
      <Text style={styles.summary} numberOfLines={2}>
        {analysis.summary}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.meta}>{analysis.llm_model}</Text>
        <Text style={styles.meta}>{analysis.tokens_used} tokens</Text>
        <Text style={styles.meta}>{formatDateTime(analysis.created_at)}</Text>
      </View>
    </Card>
  );
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
  deleteBtn: {
    padding: spacing.xs,
  },
  summary: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  meta: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
});
