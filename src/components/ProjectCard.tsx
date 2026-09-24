import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from './ui';
import { ProjectSummary } from '../types';
import { colors, fonts, spacing } from '../theme';
import { formatDate, truncate, formatUrl } from '../utils/format';

interface Props {
  project: ProjectSummary;
  onPress: () => void;
}

export const ProjectCard = memo(function ProjectCard({ project, onPress }: Props) {
  const isApi = project.project_type === 'api';

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
        <View style={styles.headerBadges}>
          {isApi && <Badge text="API" variant="info" />}
          <Badge
            text={project.status}
            variant={project.status === 'active' ? 'success' : 'default'}
          />
        </View>
      </View>

      {project.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          {truncate(project.description, 100)}
        </Text>
      ) : null}

      <Text style={styles.url} numberOfLines={1}>
        {formatUrl(project.base_url)}
      </Text>

      <View style={styles.footer}>
        {isApi ? (
          <View style={styles.stat}>
            <Ionicons name="cloud-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.statText}>{project.endpoint_count}</Text>
          </View>
        ) : (
          <>
            <View style={styles.stat}>
              <Ionicons name="scan-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.statText}>{project.extraction_count}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="code-slash-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.statText}>{project.generation_count}</Text>
            </View>
          </>
        )}
        <Text style={styles.date}>{formatDate(project.created_at)}</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  name: {
    color: colors.primary,
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  desc: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
  },
  url: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  date: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginLeft: 'auto',
  },
});
