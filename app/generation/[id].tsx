import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectsStore } from '../../src/stores/projects';
import { useLanguagesStore } from '../../src/stores/languages';
import { useToastStore } from '../../src/stores/toast';
import { CodeViewer } from '../../src/components/CodeViewer';
import { Badge, EmptyState, FadeInView, LoadingSkeletonCode } from '../../src/components/ui';
import { colors, fonts, spacing } from '../../src/theme';
import { formatDateTime, formatUrl } from '../../src/utils/format';
import { getBddFrameworkInfo } from '../../src/utils/framework';
import { Generation, Project } from '../../src/types';

type CodeTab = 'page' | 'test';

export default function GenerationDetailScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  const router = useRouter();
  const store = useProjectsStore();
  const languages = useLanguagesStore((s) => s.languages);
  const fetchLanguages = useLanguagesStore((s) => s.fetch);
  const toast = useToastStore((s) => s.show);
  const insets = useSafeAreaInsets();

  const [generation, setGeneration] = useState<Generation | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeTab, setCodeTab] = useState<CodeTab>('page');

  // Apply-in-progress polling state (Task 3.1)
  const [applyJobStatus, setApplyJobStatus] = useState<{
    status: string; started_at: number; current_page: number; total_pages: number; page_name: string; current_task: string;
  } | null>(null);
  const applyPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const applyElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [applyElapsed, setApplyElapsed] = useState(0);
  const applyInProgress = applyJobStatus !== null && applyJobStatus.status === 'applying';
  // Track whether apply was ever in progress during this screen visit (for auto-refresh on completion)
  const wasApplyingRef = useRef(false);

  // Editable page name
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  // Stop polling helper (Task 3.3)
  const stopPolling = useCallback(() => {
    if (applyPollTimerRef.current) {
      clearInterval(applyPollTimerRef.current);
      applyPollTimerRef.current = null;
    }
  }, []);

  // Poll apply status every 2 seconds (Task 3.1 / 3.2)
  // Polls unconditionally; only auto-refreshes generation when apply transitions applying→idle
  const pollApplyStatus = useCallback(async () => {
    if (!projectId || !id) return;
    try {
      const jobStatus = await store.getJobProgress(projectId);
      if (jobStatus.status === 'applying') {
        wasApplyingRef.current = true;
        setApplyJobStatus(jobStatus);
      } else {
        if (wasApplyingRef.current) {
          // Apply just finished → auto-refresh generation code (Task 3.5)
          wasApplyingRef.current = false;
          stopPolling();
          setApplyJobStatus(null);
          const updatedGen = await store.getGeneration(projectId, id);
          setGeneration(updatedGen);
        }
        // else: apply was never running during this visit — keep polling silently
      }
    } catch {
      stopPolling();
      setApplyJobStatus(null);
    }
  }, [projectId, id, store, stopPolling]);

  // Elapsed timer while apply is in progress (Task 3.4)
  useEffect(() => {
    if (applyInProgress && applyJobStatus?.started_at) {
      setApplyElapsed(Math.floor(Date.now() / 1000) - applyJobStatus.started_at);
      applyElapsedRef.current = setInterval(() => {
        setApplyElapsed(Math.floor(Date.now() / 1000) - applyJobStatus.started_at);
      }, 1000);
    } else {
      setApplyElapsed(0);
      if (applyElapsedRef.current) {
        clearInterval(applyElapsedRef.current);
        applyElapsedRef.current = null;
      }
    }
    return () => {
      if (applyElapsedRef.current) {
        clearInterval(applyElapsedRef.current);
        applyElapsedRef.current = null;
      }
    };
  }, [applyInProgress, applyJobStatus?.started_at]);

  // Cleanup on unmount (Task 3.3)
  useEffect(() => {
    return () => {
      stopPolling();
      if (applyElapsedRef.current) {
        clearInterval(applyElapsedRef.current);
        applyElapsedRef.current = null;
      }
    };
  }, [stopPolling]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !projectId) return;
      // Reset apply tracking on every focus (Task 3.2 / req 2.5)
      wasApplyingRef.current = false;

      Promise.all([
        store.getGeneration(projectId, id),
        store.getProject(projectId),
      ])
        .then(([gen, proj]) => {
          setGeneration(gen);
          setProject(proj);
          // Start polling unconditionally — detects applies that start while screen is open (req 2.5)
          if (!applyPollTimerRef.current) {
            applyPollTimerRef.current = setInterval(pollApplyStatus, 2000);
          }
        })
        .catch((err: any) => {
          toast('error', err?.response?.data?.error || 'Failed to load generation');
        })
        .finally(() => setLoading(false));

      // Cleanup polling when screen loses focus (Task 3.3)
      return () => {
        stopPolling();
        wasApplyingRef.current = false;
      };
    }, [id, projectId, store, toast, pollApplyStatus, stopPolling])
  );

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const languageName = generation
    ? languages.find((l) => l.id === generation.language_id)?.name || generation.language_id
    : '';

  const langDisplay = generation
    ? languages.find((l) => l.id === generation.language_id)?.display || ''
    : '';

  // ── Name edit ──

  const handleStartEditName = () => {
    setNameDraft(generation?.page_name || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (savingRef.current) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === generation?.page_name) {
      setEditingName(false);
      return;
    }
    savingRef.current = true;
    setSavingName(true);
    try {
      await store.updateGenerationPageName(projectId!, id!, trimmed);
      setGeneration((prev) => prev ? { ...prev, page_name: trimmed } : prev);
      toast('success', 'Page name updated');
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to rename');
    } finally {
      savingRef.current = false;
      setSavingName(false);
      setEditingName(false);
    }
  };

  // ── Delete generation ──

  const handleDeleteGeneration = () => {
    const doDelete = async () => {
      try {
        await store.deleteGeneration(projectId!, id!);
        toast('success', 'Generation deleted');
        router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`);
      } catch (err: any) {
        toast('error', err?.response?.data?.error || 'Failed to delete generation');
      }
    };

    if (Platform.OS === 'web') {
      if (!window.confirm('Delete this generation? This cannot be undone.')) return;
      doDelete();
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Delete Generation', 'This will permanently delete this generation.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Loading...</Text>
          </View>
        </View>
        <LoadingSkeletonCode />
      </View>
    );
  }

  if (!generation) return <EmptyState title="Generation not found" />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          {editingName ? (
            <View style={styles.titleEditRow}>
              <TextInput
                style={styles.titleInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={handleSaveName}
                onSubmitEditing={handleSaveName}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
              />
              {savingName && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
          ) : (
            <Pressable onPress={handleStartEditName} style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {generation.page_name}
              </Text>
              <Ionicons name="pencil-outline" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={handleDeleteGeneration} hitSlop={8}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </Pressable>
      </View>

      {/* Apply-in-progress banner (Task 3.4) */}
      {applyInProgress && applyJobStatus ? (
        <View style={styles.applyBanner}>
          <ActivityIndicator size="small" color={colors.warning} />
          <View style={styles.applyBannerText}>
            <Text style={styles.applyBannerTitle}>Applying improvements…</Text>
            <Text style={styles.applyBannerSub}>
              {formatElapsed(applyElapsed)} elapsed
              {applyJobStatus.page_name ? ` · ${applyJobStatus.page_name}` : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.infoRow}>
          <Badge
            text={generation.status}
            variant={generation.status === 'completed' ? 'success' : generation.status === 'failed' ? 'danger' : 'warning'}
          />
          <Text style={styles.meta}>{formatDateTime(generation.created_at)}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="hardware-chip-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.statText}>{generation.llm_model}</Text>
          </View>
          {langDisplay ? (
            <View style={styles.stat}>
              <Ionicons name="code-slash-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.statText}>{langDisplay}</Text>
            </View>
          ) : null}
          <View style={styles.stat}>
            <Ionicons name="analytics-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.statText}>{generation.tokens_used} tokens</Text>
          </View>
        </View>
        {languageName && getBddFrameworkInfo(languageName) && (
          <View style={styles.bddIndicator}>
            <Ionicons name="git-branch-outline" size={14} color={colors.success} />
            <Text style={styles.bddIndicatorText}>
              {getBddFrameworkInfo(languageName)!.name} BDD scaffold included in ZIP
            </Text>
          </View>
        )}
        {project ? (
          <Text style={styles.baseUrl}>{formatUrl(project.base_url)}</Text>
        ) : null}
      </View>

      {/* Code Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, codeTab === 'page' && styles.tabActive]}
          onPress={() => setCodeTab('page')}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={codeTab === 'page' ? colors.primary : colors.textTertiary}
          />
          <Text style={[styles.tabText, codeTab === 'page' && styles.tabTextActive]}>
            Page Object
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, codeTab === 'test' && styles.tabActive]}
          onPress={() => setCodeTab('test')}
        >
          <Ionicons
            name="flask-outline"
            size={16}
            color={codeTab === 'test' ? colors.primary : colors.textTertiary}
          />
          <Text style={[styles.tabText, codeTab === 'test' && styles.tabTextActive]}>
            Test Code
          </Text>
        </Pressable>
      </View>

      {/* Code */}
      <ScrollView style={styles.codeContainer} contentContainerStyle={styles.codeContent} keyboardDismissMode="on-drag">
        <FadeInView key={codeTab} duration={200}>
          <CodeViewer
            code={codeTab === 'page' ? generation.page_code : generation.test_code}
            language={languageName}
          />
        </FadeInView>
      </ScrollView>
    </View>
  );
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleInput: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  info: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    flexWrap: 'wrap',
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
  meta: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  bddIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    backgroundColor: 'rgba(63, 185, 80, 0.08)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.2)',
    alignSelf: 'flex-start',
  },
  bddIndicatorText: {
    color: colors.success,
    fontSize: fonts.sizes.xs,
    fontWeight: '500',
  },
  baseUrl: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginTop: spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
  },
  codeContainer: {
    flex: 1,
  },
  codeContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  applyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(210, 153, 34, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(210, 153, 34, 0.25)',
  },
  applyBannerText: {
    flex: 1,
  },
  applyBannerTitle: {
    color: colors.warning,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
  },
  applyBannerSub: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginTop: 1,
  },
});
