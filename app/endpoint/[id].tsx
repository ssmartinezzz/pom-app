import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectsStore } from '../../src/stores/projects';
import { useToastStore } from '../../src/stores/toast';
import { EndpointForm } from '../../src/components/EndpointForm';
import { CodeViewer } from '../../src/components/CodeViewer';
import { Badge, Button, LoadingSkeletonList } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { formatDateTime } from '../../src/utils/format';
import { ApiEndpoint } from '../../src/types';

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

export default function EndpointDetailScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  const router = useRouter();
  const store = useProjectsStore();
  const toast = useToastStore((s) => s.show);
  const insets = useSafeAreaInsets();

  const [endpoint, setEndpoint] = useState<ApiEndpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const loadData = useCallback(async () => {
    if (!id || !projectId) return;
    try {
      const ep = await store.getApiEndpoint(projectId, id);
      setEndpoint(ep);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to load endpoint');
    } finally {
      setLoading(false);
    }
  }, [id, projectId, store, toast]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Delete this endpoint?')) return;
      doDelete();
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Delete Endpoint', 'This will permanently delete this endpoint.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const doDelete = async () => {
    try {
      await store.deleteApiEndpoint(projectId!, id!);
      toast('success', 'Endpoint deleted');
      router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to delete endpoint');
    }
  };

  const handleUpdate = async (data: any) => {
    await store.updateApiEndpoint(projectId!, id!, data);
    toast('success', 'Endpoint updated');
    setShowEdit(false);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <LoadingSkeletonList count={3} />
      </View>
    );
  }

  if (!endpoint) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Not found</Text>
        </View>
      </View>
    );
  }

  const hasHeaders = endpoint.headers && Object.keys(endpoint.headers).length > 0;
  const hasBody = !!endpoint.request_body;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{endpoint.name}</Text>
        </View>
        <Pressable onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Method + Path hero */}
        <View style={styles.hero}>
          <View style={[styles.methodBadge, { backgroundColor: METHOD_COLORS[endpoint.method] }]}>
            <Text style={styles.methodText}>{endpoint.method}</Text>
          </View>
          <Text style={styles.pathText}>{endpoint.path}</Text>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <Badge text={`Status: ${endpoint.expected_status}`} variant="default" />
          <Text style={styles.dateText}>{formatDateTime(endpoint.created_at)}</Text>
        </View>

        {endpoint.description ? (
          <Text style={styles.description}>{endpoint.description}</Text>
        ) : null}

        {/* Headers */}
        {hasHeaders && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Headers</Text>
            <View style={styles.codeBlock}>
              {Object.entries(endpoint.headers).map(([key, val]) => (
                <View key={key} style={styles.headerRow}>
                  <Text style={styles.headerKey}>{key}:</Text>
                  <Text style={styles.headerVal}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Request Body */}
        {hasBody && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Request Body</Text>
            <CodeViewer code={formatJson(endpoint.request_body)} language="json" />
          </View>
        )}

        <View style={styles.actions}>
          <Button title="Edit Endpoint" onPress={() => setShowEdit(true)} />
        </View>
      </ScrollView>

      {/* Edit modal */}
      <EndpointForm
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={handleUpdate}
        endpoint={endpoint}
      />
    </View>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  methodBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  methodText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: '700',
    fontFamily: fonts.mono,
  },
  pathText: {
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontFamily: fonts.mono,
    fontWeight: '500',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dateText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  description: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  codeBlock: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerKey: {
    color: colors.primary,
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.mono,
    fontWeight: '600',
  },
  headerVal: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.mono,
    flex: 1,
  },
  actions: {
    marginTop: spacing.md,
  },
});
