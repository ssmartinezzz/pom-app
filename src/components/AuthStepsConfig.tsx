import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjectsStore } from '../stores/projects';
import { useToastStore } from '../stores/toast';
import { colors, fonts, radius, spacing } from '../theme';
import { AuthStep, ExtractionSummary, PageElement } from '../types';

// ── Types ──────────────────────────────────────────────

interface Props {
  projectId: string;
  extractions: ExtractionSummary[];
  onStepsChange: (steps: AuthStep[]) => void;
  initialSteps?: AuthStep[];
}

interface StepItem {
  id: string;
  action: AuthStep['action'];
  url?: string;
  selector?: string;
  value?: string;
  for?: string;
  timeout?: number;
  source?: string; // extraction title, UI-only
  expanded: boolean;
}

// ── Constants ──────────────────────────────────────────

const ACTIONS: AuthStep['action'][] = ['navigate', 'fill', 'click', 'wait', 'select'];

export const ACTION_META: Record<string, { icon: string; color: string; bg: string }> = {
  navigate: { icon: 'globe-outline', color: '#58a6ff', bg: '#58a6ff18' },
  fill: { icon: 'create-outline', color: '#3fb950', bg: '#3fb95018' },
  click: { icon: 'hand-left-outline', color: '#d29922', bg: '#d2992218' },
  wait: { icon: 'time-outline', color: '#8b949e', bg: '#8b949e18' },
  select: { icon: 'list-outline', color: '#bc8cff', bg: '#bc8cff18' },
};

let _sid = 0;
const sid = () => `s_${++_sid}_${Date.now()}`;

const needsSelector = (a: string) => a === 'fill' || a === 'click' || a === 'select';
const needsValue = (a: string) => a === 'fill' || a === 'navigate' || a === 'wait' || a === 'select';

function stepDetail(s: StepItem): string {
  const suffix = s.timeout ? ` → ${s.timeout / 1000}s` : '';
  if (s.action === 'navigate') return (s.url || s.value || '') + suffix;
  if (s.action === 'wait') return (s.for || s.value || 'networkidle') + suffix;
  if (s.action === 'fill' || s.action === 'select') {
    const val = s.selector?.toLowerCase().includes('password') ? '********' : (s.value || '');
    return s.selector ? `${s.selector}  →  ${val}${suffix}` : '';
  }
  return (s.selector || '') + suffix;
}

function valuePlaceholder(a: string): string {
  switch (a) {
    case 'navigate': return 'https://...';
    case 'fill': return 'Value to type';
    case 'wait': return 'networkidle';
    case 'select': return 'Option text';
    default: return '';
  }
}

// ── StepCard ───────────────────────────────────────────

const StepCard = memo(function StepCard({
  step,
  index,
  total,
  onUpdate,
  onDelete,
  onMove,
  onToggleExpand,
  onPickSelector,
}: {
  step: StepItem;
  index: number;
  total: number;
  onUpdate: (id: string, patch: Partial<StepItem>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onToggleExpand: (id: string) => void;
  onPickSelector: (id: string) => void;
}) {
  const meta = ACTION_META[step.action];

  return (
    <View style={styles.stepCard}>
      <Pressable style={styles.stepRow} onPress={() => onToggleExpand(step.id)}>
        {/* Reorder handle */}
        <View style={styles.reorderHandle}>
          <Ionicons name="reorder-three-outline" size={18} color={colors.textTertiary} />
        </View>

        {/* Number */}
        <Text style={styles.stepNum}>{index + 1}</Text>

        {/* Action badge */}
        <View style={[styles.actionBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as any} size={12} color={meta.color} />
          <Text style={[styles.actionBadgeText, { color: meta.color }]}>{step.action}</Text>
        </View>

        {/* Detail */}
        <Text style={styles.stepDetail} numberOfLines={1}>
          {stepDetail(step)}
        </Text>

        {/* Expand chevron */}
        <Ionicons
          name={step.expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textTertiary}
        />
      </Pressable>

      {/* Expanded edit mode */}
      {step.expanded && (
        <View style={styles.stepEditArea}>
          {/* Action picker chips */}
          <View style={styles.editActionRow}>
            {ACTIONS.map((a) => {
              const m = ACTION_META[a];
              const active = step.action === a;
              return (
                <Pressable
                  key={a}
                  style={[styles.editActionChip, active && { backgroundColor: m.color }]}
                  onPress={() => onUpdate(step.id, { action: a })}
                >
                  <Ionicons name={m.icon as any} size={14} color={active ? colors.bg : m.color} />
                  <Text style={[styles.editActionText, active && { color: colors.bg }]}>{a}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Selector input */}
          {needsSelector(step.action) && (
            <View style={styles.selectorRow}>
              <TextInput
                style={[styles.editInput, { flex: 1 }]}
                value={step.selector || ''}
                onChangeText={(v) => onUpdate(step.id, { selector: v })}
                placeholder="CSS selector (e.g. #add-to-cart)"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.pickSelectorBtn} onPress={() => onPickSelector(step.id)}>
                <Ionicons name="apps-outline" size={18} color={colors.primary} />
              </Pressable>
            </View>
          )}

          {/* Value input */}
          {needsValue(step.action) && (
            <TextInput
              style={styles.editInput}
              value={step.action === 'navigate' ? (step.url || step.value || '') : (step.action === 'wait' ? (step.for || step.value || '') : (step.value || ''))}
              onChangeText={(v) => {
                if (step.action === 'navigate') onUpdate(step.id, { url: v, value: v });
                else if (step.action === 'wait') onUpdate(step.id, { for: v, value: v });
                else onUpdate(step.id, { value: v });
              }}
              placeholder={valuePlaceholder(step.action)}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={step.selector?.toLowerCase().includes('password') || false}
            />
          )}

          {/* Timeout input */}
          <TextInput
            style={[styles.editInput, styles.timeoutInput]}
            value={step.timeout ? String(step.timeout) : ''}
            onChangeText={(v) => {
              const num = parseInt(v, 10);
              if (v === '') onUpdate(step.id, { timeout: undefined });
              else if (!isNaN(num)) onUpdate(step.id, { timeout: num });
            }}
            onBlur={() => {
              if (step.timeout && step.timeout < 5000) onUpdate(step.id, { timeout: 5000 });
            }}
            placeholder={`Timeout (ms) — default: ${step.action === 'navigate' || step.action === 'wait' ? '30000' : '10000'}`}
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />

          {/* Reorder buttons + Done */}
          <View style={styles.editFooter}>
            <View style={styles.reorderBtns}>
              <Pressable
                onPress={() => onMove(step.id, 'up')}
                disabled={index === 0}
                style={[styles.reorderBtn, index === 0 && { opacity: 0.3 }]}
                hitSlop={8}
              >
                <Ionicons name="arrow-up" size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => onMove(step.id, 'down')}
                disabled={index === total - 1}
                style={[styles.reorderBtn, index === total - 1 && { opacity: 0.3 }]}
                hitSlop={8}
              >
                <Ionicons name="arrow-down" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Pressable style={styles.doneBtn} onPress={() => onToggleExpand(step.id)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>

          {/* Delete Step danger button */}
          <Pressable style={styles.deleteStepBtn} onPress={() => onDelete(step.id)}>
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={styles.deleteStepBtnText}>Delete Step</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

// ── Main Component ─────────────────────────────────────

export const PreStepsConfig = memo(function PreStepsConfig({ projectId, extractions, onStepsChange, initialSteps }: Props) {
  const store = useProjectsStore();
  const toast = useToastStore((s) => s.show);
  const [enabled, setEnabled] = useState(() => (initialSteps && initialSteps.length > 0) || false);
  const [steps, setSteps] = useState<StepItem[]>(() => {
    if (!initialSteps || initialSteps.length === 0) return [];
    return initialSteps.map((s) => ({
      id: sid(),
      action: s.action,
      url: s.url,
      selector: s.selector,
      value: s.value,
      for: s.for,
      timeout: s.timeout,
      expanded: false,
    }));
  });

  // Import picker state
  const [showPicker, setShowPicker] = useState(false);
  const [importing, setImporting] = useState(false);
  // Cache for fetched steps: extId -> AuthStep[] | null (null = no steps)
  const [stepsCache, setStepsCache] = useState<Map<string, AuthStep[] | null>>(new Map());
  const [fetchingSteps, setFetchingSteps] = useState(false);

  // Selector picker state
  const [pickingForStepId, setPickingForStepId] = useState<string | null>(null);
  const [pickerExtId, setPickerExtId] = useState<string | null>(null);
  const [elementsCache, setElementsCache] = useState<Map<string, PageElement[]>>(new Map());
  const [loadingElements, setLoadingElements] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');

  const completedExtractions = useMemo(
    () => extractions.filter((e) => e.status === 'completed'),
    [extractions],
  );

  // Eager-fetch all extraction steps when picker opens
  useEffect(() => {
    if (!showPicker || !projectId || completedExtractions.length === 0) return;

    const uncached = completedExtractions.filter((e) => !stepsCache.has(e.id));
    if (uncached.length === 0) return;

    setFetchingSteps(true);
    Promise.all(
      uncached.map((e) =>
        store.getExtraction(projectId, e.id)
          .then((ext) => ({ id: e.id, steps: ext.pre_steps && ext.pre_steps.length > 0 ? ext.pre_steps : null }))
          .catch(() => ({ id: e.id, steps: null as AuthStep[] | null }))
      )
    ).then((results) => {
      setStepsCache((prev) => {
        const next = new Map(prev);
        results.forEach((r) => next.set(r.id, r.steps));
        return next;
      });
      setFetchingSteps(false);
    });
  }, [showPicker, projectId, completedExtractions, stepsCache, store]);

  // Emit steps to parent
  useEffect(() => {
    if (!enabled) {
      onStepsChange([]);
      return;
    }
    const authSteps: AuthStep[] = steps.map((s) => {
      const step: AuthStep = { action: s.action };
      if (s.action === 'navigate') step.url = s.url || s.value;
      else if (s.action === 'wait') step.for = s.for || s.value || 'networkidle';
      else {
        if (s.selector) step.selector = s.selector;
        if (s.value) step.value = s.value;
      }
      if (s.timeout && s.timeout >= 5000) step.timeout = s.timeout;
      return step;
    });
    onStepsChange(authSteps);
  }, [enabled, steps, onStepsChange]);

  // ── Handlers ──

  const handleToggle = (val: boolean) => {
    setEnabled(val);
    if (!val) {
      setSteps([]);
    }
  };

  const handlePickerImport = useCallback(async (extId: string, extTitle: string) => {
    if (!projectId) return;
    setImporting(true);
    try {
      // Use cache if available, otherwise fetch
      let preSteps = stepsCache.get(extId);
      if (preSteps === undefined) {
        const ext = await store.getExtraction(projectId, extId);
        preSteps = ext.pre_steps && ext.pre_steps.length > 0 ? ext.pre_steps : null;
        setStepsCache((prev) => {
          const next = new Map(prev);
          next.set(extId, preSteps!);
          return next;
        });
      }

      if (!preSteps || preSteps.length === 0) {
        toast('warning', 'This extraction has no pre-steps to import');
        setImporting(false);
        return;
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const imported: StepItem[] = preSteps.map((s) => ({
        id: sid(),
        action: s.action,
        url: s.url,
        selector: s.selector,
        value: s.value,
        for: s.for,
        timeout: s.timeout,
        source: extTitle || 'Extraction',
        expanded: false,
      }));
      setSteps((prev) => [...prev, ...imported]);
      toast('success', `Imported ${imported.length} step${imported.length !== 1 ? 's' : ''}`);
    } catch {
      toast('error', 'Failed to import steps');
    }
    setImporting(false);
    setShowPicker(false);
  }, [projectId, store, stepsCache, toast]);

  const handleUpdate = useCallback((id: string, patch: Partial<StepItem>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)));
  }, []);

  const addStep = useCallback((action: AuthStep['action']) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSteps((prev) => [...prev, { id: sid(), action, expanded: true }]);
  }, []);

  // ── Selector Picker Handlers ──

  const handleOpenSelectorPicker = useCallback((stepId: string) => {
    setPickingForStepId(stepId);
    setPickerExtId(null);
    setPickerFilter('');
  }, []);

  const handlePickExtraction = useCallback(async (extId: string) => {
    setPickerExtId(extId);
    if (elementsCache.has(extId)) return;
    setLoadingElements(true);
    try {
      const ext = await store.getExtraction(projectId, extId);
      setElementsCache(prev => new Map(prev).set(extId, ext.elements_json || []));
    } catch {
      toast('error', 'Failed to load elements');
    }
    setLoadingElements(false);
  }, [projectId, store, elementsCache, toast]);

  const handlePickElement = useCallback((element: PageElement) => {
    if (!pickingForStepId) return;
    handleUpdate(pickingForStepId, { selector: element.selector });
    setPickingForStepId(null);
    setPickerExtId(null);
    setPickerFilter('');
  }, [pickingForStepId, handleUpdate]);

  const closeSelectorPicker = useCallback(() => {
    setPickingForStepId(null);
    setPickerExtId(null);
    setPickerFilter('');
  }, []);

  // ── Derived ──

  // Source labels
  const sourceLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    let lastSource = '';
    steps.forEach((s, i) => {
      if (s.source && s.source !== lastSource) {
        labels[i] = s.source;
      }
      lastSource = s.source || '';
    });
    return labels;
  }, [steps]);

  // Selector picker: filtered elements
  const pickerElements = useMemo(() => {
    if (!pickerExtId) return [];
    const all = elementsCache.get(pickerExtId) || [];
    if (!pickerFilter.trim()) return all;
    const q = pickerFilter.toLowerCase();
    return all.filter((el) =>
      [el.tag, el.id, el.name, el.selector, el.placeholder, el.text, el.type]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [pickerExtId, elementsCache, pickerFilter]);

  // Summary breakdown by action type
  const summaryBreakdown = useMemo(() => {
    if (steps.length === 0) return '';
    const counts: Record<string, number> = {};
    steps.forEach((s) => {
      counts[s.action] = (counts[s.action] || 0) + 1;
    });
    const parts = Object.entries(counts).map(([action, count]) => `${count} ${action}`);
    return `${steps.length} step${steps.length !== 1 ? 's' : ''}: ${parts.join(', ')}`;
  }, [steps]);

  // ── Render ──

  return (
    <View style={styles.container}>
      {/* Toggle */}
      <Pressable style={styles.toggleRow} onPress={() => handleToggle(!enabled)}>
        <Ionicons
          name="list-outline"
          size={18}
          color={enabled ? colors.primary : colors.textTertiary}
        />
        <Text style={[styles.toggleLabel, enabled && styles.toggleLabelActive]}>
          Pre-extraction steps
        </Text>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.bgTertiary, true: colors.primaryDark }}
          thumbColor={enabled ? colors.primary : colors.textTertiary}
        />
      </Pressable>

      {enabled && (
        <View style={styles.content}>
          {/* Import Button */}
          {completedExtractions.length > 0 && (
            <Pressable style={styles.importButton} onPress={() => setShowPicker(true)}>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.importButtonText}>Import from previous extraction</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </Pressable>
          )}

          {/* Step List */}
          {steps.length === 0 && (
            <Text style={styles.emptyText}>
              {completedExtractions.length > 0
                ? 'Import steps from a previous extraction or add custom steps below'
                : 'Add steps to run before extracting (login, add to cart, navigate...)'}
            </Text>
          )}

          {steps.map((step, idx) => (
            <View key={step.id}>
              {sourceLabels[idx] && (
                <Text style={styles.sourceLabel}>From: {sourceLabels[idx]}</Text>
              )}
              <StepCard
                step={step}
                index={idx}
                total={steps.length}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onMove={handleMove}
                onToggleExpand={handleToggleExpand}
                onPickSelector={handleOpenSelectorPicker}
              />
            </View>
          ))}

          {/* Add Step Chips - horizontal scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.addBar}
            style={styles.addBarScroll}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            {ACTIONS.map((a) => {
              const m = ACTION_META[a];
              return (
                <Pressable
                  key={a}
                  style={styles.addChip}
                  onPress={() => addStep(a)}
                >
                  <Ionicons name={m.icon as any} size={13} color={m.color} />
                  <Text style={[styles.addChipText, { color: m.color }]}>{a}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Summary Footer with breakdown */}
          {steps.length > 0 && (
            <View style={styles.summary}>
              <Text style={styles.summaryText}>{summaryBreakdown}</Text>
            </View>
          )}

          {/* Extraction Picker Modal (import pre-steps) */}
          <Modal
            visible={showPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPicker(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
              <Pressable style={styles.modalContent} onPress={() => {}}>
                {/* Drag handle */}
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Import pre-steps</Text>
                <Text style={styles.modalSubtitle}>
                  Tap an extraction to import its pre-steps
                </Text>

                {fetchingSteps && (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.modalLoadingText}>Loading steps info...</Text>
                  </View>
                )}

                <FlatList
                  data={completedExtractions}
                  keyExtractor={(item) => item.id}
                  ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                  renderItem={({ item }) => {
                    const cachedSteps = stepsCache.get(item.id);
                    const stepCount = cachedSteps ? cachedSteps.length : 0;
                    const hasSteps = cachedSteps !== undefined && cachedSteps !== null && cachedSteps.length > 0;
                    const isLoaded = stepsCache.has(item.id);

                    return (
                      <Pressable
                        style={styles.modalItem}
                        onPress={() => handlePickerImport(item.id, item.page_title || 'Extraction')}
                        disabled={importing}
                      >
                        <View style={styles.modalItemInfo}>
                          <Text style={styles.modalItemTitle} numberOfLines={1}>
                            {item.page_title || 'Untitled'}
                          </Text>
                          <Text style={styles.modalItemUrl} numberOfLines={1}>
                            {item.url}
                          </Text>
                        </View>
                        <View style={styles.modalItemRight}>
                          {!isLoaded ? (
                            <ActivityIndicator size="small" color={colors.textTertiary} />
                          ) : hasSteps ? (
                            <View style={styles.stepCountBadge}>
                              <Ionicons name="list-outline" size={12} color={colors.primary} />
                              <Text style={styles.stepCountText}>{stepCount}</Text>
                            </View>
                          ) : (
                            <Text style={styles.noStepsText}>No steps</Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No completed extractions</Text>
                  }
                />

                {importing && (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.modalLoadingText}>Importing...</Text>
                  </View>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          {/* Selector Picker Modal */}
          <Modal
            visible={pickingForStepId !== null}
            transparent
            animationType="slide"
            onRequestClose={closeSelectorPicker}
          >
            <Pressable style={styles.modalOverlay} onPress={closeSelectorPicker}>
              <Pressable style={styles.modalContent} onPress={() => {}}>
                <View style={styles.modalHandle} />

                {pickerExtId === null ? (
                  <>
                    <Text style={styles.modalTitle}>Pick a selector</Text>
                    <Text style={styles.modalSubtitle}>
                      Choose an extraction to browse its elements
                    </Text>
                    <FlatList
                      data={completedExtractions}
                      keyExtractor={(item) => item.id}
                      ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.modalItem}
                          onPress={() => handlePickExtraction(item.id)}
                        >
                          <View style={styles.modalItemInfo}>
                            <Text style={styles.modalItemTitle} numberOfLines={1}>
                              {item.page_title || 'Untitled'}
                            </Text>
                            <Text style={styles.modalItemUrl} numberOfLines={1}>
                              {item.url}
                            </Text>
                          </View>
                          <View style={styles.modalItemRight}>
                            <View style={styles.stepCountBadge}>
                              <Ionicons name="cube-outline" size={12} color={colors.primary} />
                              <Text style={styles.stepCountText}>{item.element_count} el.</Text>
                            </View>
                          </View>
                        </Pressable>
                      )}
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>No completed extractions</Text>
                      }
                    />
                  </>
                ) : (
                  <>
                    {/* Back + title */}
                    <View style={styles.pickerBackRow}>
                      <Pressable
                        onPress={() => { setPickerExtId(null); setPickerFilter(''); }}
                        hitSlop={8}
                      >
                        <Ionicons name="arrow-back" size={20} color={colors.primary} />
                      </Pressable>
                      <Text style={[styles.modalTitle, { flex: 1, paddingTop: 0 }]} numberOfLines={1}>
                        {completedExtractions.find(e => e.id === pickerExtId)?.page_title || 'Elements'}
                      </Text>
                    </View>

                    {/* Filter bar */}
                    <View style={styles.pickerFilterBar}>
                      <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
                      <TextInput
                        style={styles.pickerFilterInput}
                        value={pickerFilter}
                        onChangeText={setPickerFilter}
                        placeholder="Filter elements..."
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {pickerFilter.length > 0 && (
                        <Pressable onPress={() => setPickerFilter('')} hitSlop={8}>
                          <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                        </Pressable>
                      )}
                    </View>

                    {loadingElements ? (
                      <View style={styles.modalLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.modalLoadingText}>Loading elements...</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={pickerElements}
                        keyExtractor={(_, i) => String(i)}
                        ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                        renderItem={({ item: el }) => {
                          const ident = el.id || el.name || el.placeholder || el.text;
                          return (
                            <Pressable style={styles.pickerElement} onPress={() => handlePickElement(el)}>
                              <Text style={styles.pickerElementTag}>
                                {'<'}{el.tag}{el.type ? ` type="${el.type}"` : ''}{'>'}
                              </Text>
                              {ident ? (
                                <Text style={styles.pickerElementId} numberOfLines={1}>{ident}</Text>
                              ) : null}
                              <Text style={styles.pickerElementSelector} numberOfLines={1}>
                                {el.selector}
                              </Text>
                            </Pressable>
                          );
                        }}
                        ListEmptyComponent={
                          <Text style={styles.emptyText}>
                            {pickerFilter ? 'No matching elements' : 'No elements'}
                          </Text>
                        }
                      />
                    )}
                  </>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      )}
    </View>
  );
});

// ── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: colors.text,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },

  // Import button (single button replacing dropdown + import btn)
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  importButtonText: {
    flex: 1,
    color: colors.primary,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },

  // Empty state
  emptyText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  // Source label
  sourceLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 4,
    marginLeft: 4,
  },

  // Step card
  stepCard: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  reorderHandle: {
    paddingRight: 4,
    opacity: 0.5,
  },
  stepNum: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 80,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stepDetail: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
  },

  // Edit area
  stepEditArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  editActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  editActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.bgTertiary,
  },
  editActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  editInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fonts.sizes.sm,
    minHeight: 40,
  },
  timeoutInput: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  editFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reorderBtns: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  reorderBtn: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    padding: 6,
  },
  doneBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
  },
  doneBtnText: {
    color: colors.primary,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
  },
  deleteStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  deleteStepBtnText: {
    color: colors.danger,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },

  // Add bar (horizontal scroll)
  addBarScroll: {
    marginTop: spacing.sm,
  },
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: spacing.md,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addChipText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Summary
  summary: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '65%',
    paddingBottom: spacing.lg,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.textTertiary,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  modalSubtitle: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  modalLoadingText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  modalSeparator: {
    height: 1,
    backgroundColor: colors.border,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemTitle: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  modalItemUrl: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  modalItemRight: {
    marginLeft: spacing.sm,
    alignItems: 'center',
  },
  stepCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryDark + '25',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepCountText: {
    color: colors.primary,
    fontSize: fonts.sizes.xs,
    fontWeight: '700',
  },
  noStepsText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    fontStyle: 'italic',
  },

  // Selector picker
  selectorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  pickSelectorBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pickerFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 38,
  },
  pickerFilterInput: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.sizes.sm,
    paddingVertical: 0,
  },
  pickerElement: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 2,
  },
  pickerElementTag: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  pickerElementId: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
  },
  pickerElementSelector: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
