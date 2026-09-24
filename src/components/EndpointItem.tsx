import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from './ui';
import { ApiEndpointSummary } from '../types';
import { colors, fonts, spacing } from '../theme';
import { formatDateTime } from '../utils/format';

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

interface Props {
  endpoint: ApiEndpointSummary;
  onPress: () => void;
  onDelete?: () => void;
}

export const EndpointItem = memo(function EndpointItem({ endpoint, onPress, onDelete }: Props) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.methodBadge, { backgroundColor: METHOD_COLORS[endpoint.method] || colors.textTertiary }]}>
          <Text style={styles.methodText}>{endpoint.method}</Text>
        </View>
        <Text style={styles.path} numberOfLines={1}>{endpoint.path}</Text>
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        )}
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{endpoint.name}</Text>
        <Badge text={`${endpoint.expected_status}`} variant="default" />
      </View>
      {endpoint.description ? (
        <Text style={styles.desc} numberOfLines={1}>{endpoint.description}</Text>
      ) : null}
      <Text style={styles.date}>{formatDateTime(endpoint.created_at)}</Text>
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
  methodBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  methodText: {
    color: '#fff',
    fontSize: fonts.sizes.xs,
    fontWeight: '700',
    fontFamily: fonts.mono,
  },
  path: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '500',
    fontFamily: fonts.mono,
    flex: 1,
  },
  deleteBtn: {
    padding: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  name: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  desc: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginBottom: spacing.xs,
  },
  date: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
});
