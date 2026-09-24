import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectsStore } from '../../src/stores/projects';
import { useToastStore } from '../../src/stores/toast';
import { CodeViewer } from '../../src/components/CodeViewer';
import { Badge, EmptyState, FadeInView, LoadingSkeletonCode } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { formatDateTime } from '../../src/utils/format';
import { Analysis } from '../../src/types';

type AnalysisTab = 'summary' | 'selectors' | 'assertions' | 'bdd';

type StrategyCategory = {
  key: keyof Analysis['test_strategy'];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const STRATEGY_CATEGORIES: StrategyCategory[] = [
  { key: 'smoke_tests', label: 'Smoke Tests', icon: 'flame-outline' },
  { key: 'functional_tests', label: 'Functional Tests', icon: 'checkmark-done-outline' },
  { key: 'edge_cases', label: 'Edge Cases', icon: 'warning-outline' },
  { key: 'negative_tests', label: 'Negative Tests', icon: 'close-circle-outline' },
  { key: 'accessibility_tests', label: 'Accessibility Tests', icon: 'accessibility-outline' },
];

const RESILIENCE_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
};

export default function AnalysisDetailScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  const router = useRouter();
  const store = useProjectsStore();
  const toast = useToastStore((s) => s.show);
  const insets = useSafeAreaInsets();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('summary');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyOpts, setApplyOpts] = useState({
    apply_selectors: true,
    apply_tests: true,
    apply_assertions: true,
    apply_comments: true,
  });

  useFocusEffect(
    useCallback(() => {
      if (!id || !projectId) return;
      store
        .getAnalysis(projectId, id)
        .then(setAnalysis)
        .catch((err: any) => {
          toast('error', err?.response?.data?.error || 'Failed to load analysis');
        })
        .finally(() => setLoading(false));
    }, [id, projectId, store, toast])
  );

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApplyImprovements = async () => {
    if (!id || !projectId) return;
    setApplying(true);
    try {
      const { api } = await import('../../src/api/client');
      const { data } = await api.post(`/projects/${projectId}/analyses/${id}/apply`, applyOpts, { timeout: 30000 });
      const pagesUpdated = data?.pages_updated ?? 0;
      toast('success', data?.message || `Applying improvements to ${pagesUpdated} pages in background`);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to apply improvements');
    } finally {
      setApplying(false);
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

  if (!analysis) return <EmptyState title="Analysis not found" />;

  const renderSummaryTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
      <FadeInView duration={200}>
        <Text style={styles.summaryText}>{analysis.summary}</Text>

        <Text style={styles.sectionTitle}>Test Strategy</Text>
        {STRATEGY_CATEGORIES.map((cat) => {
          const items = analysis.test_strategy[cat.key] || [];
          const isExpanded = expandedCategories.has(cat.key);
          return (
            <View key={cat.key} style={styles.strategyCategory}>
              <Pressable
                style={styles.strategyHeader}
                onPress={() => toggleCategory(cat.key)}
              >
                <View style={styles.strategyLeft}>
                  <Ionicons name={cat.icon} size={16} color={colors.primary} />
                  <Text style={styles.strategyLabel}>{cat.label}</Text>
                </View>
                <View style={styles.strategyRight}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{items.length}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textTertiary}
                  />
                </View>
              </Pressable>
              {isExpanded && items.length > 0 && (
                <View style={styles.strategyItems}>
                  {items.map((item, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={styles.bullet}>{'\u2022'}</Text>
                      <Text style={styles.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </FadeInView>
    </ScrollView>
  );

  const renderSelectorsTab = () => (
    <FlatList
      data={analysis.selector_analysis || []}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={styles.tabContentInner}
      renderItem={({ item }) => (
        <View style={styles.selectorItem}>
          <Text style={styles.monoText}>{item.current_selector}</Text>
          <Badge
            text={item.resilience}
            variant={RESILIENCE_VARIANT[item.resilience] || 'default'}
          />
          {item.suggestion && item.suggestion !== item.current_selector && (
            <View style={styles.suggestionRow}>
              <Ionicons name="arrow-forward" size={12} color={colors.success} />
              <Text style={styles.suggestionText}>{item.suggestion}</Text>
            </View>
          )}
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState icon="code-outline" title="No selectors" subtitle="No selector analysis available" />
      }
    />
  );

  const renderAssertionsTab = () => (
    <FlatList
      data={analysis.assertions || []}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={styles.tabContentInner}
      renderItem={({ item }) => (
        <View style={styles.assertionItem}>
          <View style={styles.assertionHeader}>
            <Text style={styles.assertionElement}>{item.element}</Text>
            <Badge text={item.type} variant="info" />
          </View>
          <Text style={styles.assertionText}>{item.assertion}</Text>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState icon="shield-checkmark-outline" title="No assertions" subtitle="No assertions available" />
      }
    />
  );

  const renderBddTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
      <FadeInView duration={200}>
        <CodeViewer code={analysis.gherkin || ''} language="gherkin" />
      </FadeInView>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(`/project/${projectId}`)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {analysis.page_name || analysis.page_type}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.infoRow}>
          <Badge
            text={analysis.status}
            variant={analysis.status === 'completed' ? 'success' : analysis.status === 'failed' ? 'danger' : 'warning'}
          />
          <Text style={styles.meta}>{formatDateTime(analysis.created_at)}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="hardware-chip-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.statText}>{analysis.llm_model}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="analytics-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.statText}>{analysis.tokens_used.toLocaleString()} tokens</Text>
          </View>
        </View>

        {/* Selective apply options + button */}
        {analysis.status === 'completed' && (
          <View style={styles.applySection}>
            <Text style={styles.applySectionTitle}>Apply improvements</Text>
            {([
              { key: 'apply_selectors' as const, label: 'Improve selectors', icon: 'code-slash-outline' as const, desc: 'Only low-resilience' },
              { key: 'apply_tests' as const, label: 'Add/improve tests', icon: 'flask-outline' as const, desc: 'New test methods' },
              { key: 'apply_assertions' as const, label: 'Enhance assertions', icon: 'shield-checkmark-outline' as const, desc: 'Stronger checks' },
              { key: 'apply_comments' as const, label: 'Add comments', icon: 'chatbox-ellipses-outline' as const, desc: 'Business context' },
            ]).map((opt) => (
              <Pressable
                key={opt.key}
                style={styles.applyOption}
                onPress={() => setApplyOpts((prev) => ({ ...prev, [opt.key]: !prev[opt.key] }))}
              >
                <Ionicons
                  name={applyOpts[opt.key] ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={applyOpts[opt.key] ? colors.primary : colors.textTertiary}
                />
                <View style={styles.applyOptionText}>
                  <Text style={styles.applyOptionLabel}>{opt.label}</Text>
                  <Text style={styles.applyOptionDesc}>{opt.desc}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable
              style={[styles.applyBtn, (applying || !Object.values(applyOpts).some(Boolean)) && styles.applyBtnDisabled]}
              onPress={handleApplyImprovements}
              disabled={applying || !Object.values(applyOpts).some(Boolean)}
            >
              {applying ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <ActivityIndicator size="small" color={colors.warning} />
                  <Text style={[styles.applyBtnText, { color: colors.textSecondary }]}>Starting...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="sparkles" size={14} color={colors.text} />
                  <Text style={styles.applyBtnText}>
                    Apply {Object.values(applyOpts).filter(Boolean).length} of 4 improvements
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { key: 'summary' as const, label: 'Summary', icon: 'document-text-outline' as const },
          { key: 'selectors' as const, label: 'Sel.', icon: 'code-outline' as const },
          { key: 'assertions' as const, label: 'Assert', icon: 'shield-checkmark-outline' as const },
          { key: 'bdd' as const, label: 'BDD', icon: 'list-outline' as const },
        ]).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? colors.primary : colors.textTertiary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'summary' && renderSummaryTab()}
      {activeTab === 'selectors' && renderSelectorsTab()}
      {activeTab === 'assertions' && renderAssertionsTab()}
      {activeTab === 'bdd' && renderBddTab()}
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
  applySection: {
    marginTop: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  applySectionTitle: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  applyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  applyOptionText: {
    flex: 1,
  },
  applyOptionLabel: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
  },
  applyOptionDesc: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(210, 153, 34, 0.2)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
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
  tabContent: {
    flex: 1,
  },
  tabContentInner: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // Summary tab
  summaryText: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  strategyCategory: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  strategyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  strategyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  strategyLabel: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: colors.bgTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  countText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
  },
  strategyItems: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    paddingRight: spacing.md,
  },
  bullet: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.sm,
    marginRight: spacing.sm,
    lineHeight: 20,
  },
  bulletText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
    flex: 1,
  },
  // Selectors tab
  selectorItem: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  monoText: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  suggestionText: {
    color: colors.success,
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  reasonText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
  },
  // Assertions tab
  assertionItem: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  assertionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  assertionElement: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  assertionText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
  },
});
