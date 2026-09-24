import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts, radius } from '../theme';
import { Button } from './ui/Button';
import { AuthStep } from '../types';
import { ACTION_META } from './AuthStepsConfig';

interface ExtractionProgressViewProps {
  url: string;
  status: 'extracting' | 'queued' | 'success' | 'error';
  queuePosition?: number;
  estimatedWaitSeconds?: number;
  elapsedSeconds: number;
  errorMessage?: string;
  errorCode?: string;
  preSteps?: AuthStep[];
  onCancel: () => void;
  onRetry: () => void;
}

// ── Progressive timing ──────────────────────────────────

// Each phase gets progressively longer (not linear)
const BASE_STEP_SECONDS = 3;
const NAVIGATE_BASE = 4;
const LOAD_BASE = 6;
const EXTRACT_BASE = 5;
const SELECTORS_BASE = 8;

function getPhaseSeconds(phaseIndex: number, preStepCount: number): number {
  if (phaseIndex < preStepCount) {
    // Pre-steps: first ones are faster (cached browser), later ones slower
    return BASE_STEP_SECONDS + Math.floor(phaseIndex / 3);
  }
  const coreIdx = phaseIndex - preStepCount;
  if (coreIdx === 0) return NAVIGATE_BASE;
  if (coreIdx === 1) return LOAD_BASE;
  if (coreIdx === 2) return EXTRACT_BASE;
  return SELECTORS_BASE; // last phase
}

function getTotalEstimate(totalPhases: number, preStepCount: number): number {
  let total = 0;
  for (let i = 0; i < totalPhases; i++) {
    total += getPhaseSeconds(i, preStepCount);
  }
  return total;
}

// ── Phase building ──────────────────────────────────────

interface Phase {
  icon: string;
  iconColor: string;
  label: string;
  detail?: string; // sub-info: URL, selector, or value
}

function buildPhases(preSteps?: AuthStep[]): Phase[] {
  const phases: Phase[] = [];

  if (preSteps && preSteps.length > 0) {
    preSteps.forEach((step) => {
      const meta = ACTION_META[step.action];
      let label: string;
      let detail: string | undefined;

      if (step.action === 'navigate') {
        let host = '';
        try { host = new URL(step.url || '').hostname; } catch { host = step.url || 'pagina'; }
        label = `Navegando a ${host}...`;
        detail = step.url;
      } else if (step.action === 'fill') {
        const sel = step.selector || 'campo';
        label = `Rellenando ${sel}...`;
        detail = step.selector?.toLowerCase().includes('password') ? `${sel} → ********` : `${sel} → ${step.value || ''}`;
      } else if (step.action === 'click') {
        label = `Click en ${step.selector || 'elemento'}...`;
        detail = step.selector;
      } else if (step.action === 'select') {
        label = `Seleccionando en ${step.selector || 'campo'}...`;
        detail = `${step.selector || ''} → ${step.value || ''}`;
      } else {
        label = `Esperando ${step.for || 'carga'}...`;
        detail = step.for || 'networkidle';
      }

      phases.push({
        icon: meta?.icon || 'ellipsis-horizontal',
        iconColor: meta?.color || colors.textSecondary,
        label,
        detail,
      });
    });
  }

  phases.push({ icon: 'globe-outline', iconColor: '#58a6ff', label: 'Navegando a la pagina objetivo...' });
  phases.push({ icon: 'time-outline', iconColor: '#8b949e', label: 'Esperando carga completa...' });
  phases.push({ icon: 'scan-outline', iconColor: colors.primary, label: 'Identificando elementos interactivos...' });
  phases.push({ icon: 'code-slash-outline', iconColor: '#3fb950', label: 'Generando selectores unicos...' });

  return phases;
}

function getCurrentPhaseIndex(elapsed: number, totalPhases: number, preStepCount: number): number {
  let t = 0;
  for (let i = 0; i < totalPhases; i++) {
    t += getPhaseSeconds(i, preStepCount);
    if (elapsed < t || i === totalPhases - 1) return i;
  }
  return totalPhases - 1;
}

// ── Error parsing ───────────────────────────────────────

interface ParsedError {
  category: 'pre-step' | 'navigation' | 'extraction' | 'unknown';
  stepIndex?: number;
  action?: string;
  selector?: string;
  errorType: 'timeout' | 'not_found' | 'navigation' | 'network' | 'unknown';
  rawMessage: string;
  suggestion: string;
}

function parseError(message: string, code?: string): ParsedError {
  const raw = message || 'Unknown error';

  // Pre-step errors: "error ejecutando pre-extraction steps: auth step 2 fill #email: timeout 10000ms exceeded"
  const preStepMatch = raw.match(/(?:pre-?extraction\s+steps?|auth\s+step)\s*(\d+)?\s*(navigate|fill|click|wait|select)?\s*([#.\w[\]="-]*)?:\s*(.+)/i);
  if (preStepMatch || code === 'pre_step_error') {
    const stepIdx = preStepMatch?.[1] ? parseInt(preStepMatch[1], 10) : undefined;
    const action = preStepMatch?.[2]?.toLowerCase();
    const selector = preStepMatch?.[3];
    const detail = preStepMatch?.[4]?.trim() || raw;

    let errorType: ParsedError['errorType'] = 'unknown';
    if (/timeout/i.test(detail)) errorType = 'timeout';
    else if (/not\s*found|no\s*element|could\s*not\s*find/i.test(detail)) errorType = 'not_found';
    else if (/navig|url|page/i.test(detail)) errorType = 'navigation';
    else if (/network|connect|refused|dns/i.test(detail)) errorType = 'network';

    let suggestion: string;
    switch (errorType) {
      case 'timeout':
        suggestion = 'El elemento no aparecio a tiempo. Verifica que el selector existe en la pagina o aumenta el timeout del step.';
        break;
      case 'not_found':
        suggestion = 'El selector no fue encontrado en el DOM. Verifica que sea correcto y que la pagina haya cargado.';
        break;
      case 'navigation':
        suggestion = 'La URL no pudo ser alcanzada. Verifica que la URL sea correcta y accesible.';
        break;
      case 'network':
        suggestion = 'Error de conexion. Verifica que el sitio este disponible y que no requiera VPN.';
        break;
      default:
        suggestion = 'Revisa la configuracion del step y verifica que los datos sean correctos.';
    }

    return { category: 'pre-step', stepIndex: stepIdx, action, selector, errorType, rawMessage: raw, suggestion };
  }

  // Navigation errors
  if (/navig|url|page.*load|ERR_/i.test(raw) || code === 'navigation_error') {
    return {
      category: 'navigation',
      errorType: 'navigation',
      rawMessage: raw,
      suggestion: 'La pagina no pudo ser cargada. Verifica que la URL sea valida y accesible.',
    };
  }

  // Extraction errors
  if (/extract|element|scan|selector/i.test(raw) || code === 'extraction_error') {
    return {
      category: 'extraction',
      errorType: /timeout/i.test(raw) ? 'timeout' : 'unknown',
      rawMessage: raw,
      suggestion: 'La extraccion fallo. Intenta con una pagina mas simple o verifica que la pagina tenga elementos interactivos.',
    };
  }

  return {
    category: 'unknown',
    errorType: 'unknown',
    rawMessage: raw,
    suggestion: 'Ocurrio un error inesperado. Intenta de nuevo.',
  };
}

const ERROR_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  timeout: { icon: 'timer-outline', label: 'Timeout', color: colors.warning },
  not_found: { icon: 'search-outline', label: 'No encontrado', color: colors.danger },
  navigation: { icon: 'globe-outline', label: 'Navegacion', color: '#58a6ff' },
  network: { icon: 'cloud-offline-outline', label: 'Red', color: colors.danger },
  unknown: { icon: 'help-circle-outline', label: 'Error', color: colors.textSecondary },
};

const CATEGORY_LABEL: Record<string, string> = {
  'pre-step': 'Error en pre-step',
  navigation: 'Error de navegacion',
  extraction: 'Error de extraccion',
  unknown: 'Error inesperado',
};

// ── Helpers ─────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Component ───────────────────────────────────────────

function ExtractionProgressViewInner({
  url,
  status,
  queuePosition,
  estimatedWaitSeconds,
  elapsedSeconds,
  errorMessage,
  errorCode,
  preSteps,
  onCancel,
  onRetry,
}: ExtractionProgressViewProps) {
  const phases = useMemo(() => buildPhases(preSteps), [preSteps]);
  const preStepCount = preSteps?.length || 0;
  const currentPhaseIdx = getCurrentPhaseIndex(elapsedSeconds, phases.length, preStepCount);
  const totalEstimate = useMemo(() => getTotalEstimate(phases.length, preStepCount), [phases.length, preStepCount]);

  // Deterministic progress: fraction of completed phases + partial current
  const progressFraction = useMemo(() => {
    if (phases.length === 0) return 0;
    const completedFraction = currentPhaseIdx / phases.length;
    // Add partial progress within current phase
    let elapsedBefore = 0;
    for (let i = 0; i < currentPhaseIdx; i++) {
      elapsedBefore += getPhaseSeconds(i, preStepCount);
    }
    const currentPhaseDuration = getPhaseSeconds(currentPhaseIdx, preStepCount);
    const elapsedInPhase = Math.max(0, elapsedSeconds - elapsedBefore);
    const partialPhase = Math.min(1, elapsedInPhase / currentPhaseDuration) / phases.length;
    return Math.min(0.95, completedFraction + partialPhase); // cap at 95% until done
  }, [currentPhaseIdx, elapsedSeconds, phases.length, preStepCount]);

  // Scan icon rotation
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (status === 'extracting') {
      rotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, [status, rotation]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Success checkmark scale
  const successScale = useSharedValue(0);
  useEffect(() => {
    if (status === 'success') {
      successScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  }, [status, successScale]);

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));

  // Error shake
  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (status === 'error') {
      shakeX.value = withSequence(
        withTiming(8, { duration: 80 }),
        withTiming(-8, { duration: 80 }),
        withTiming(6, { duration: 80 }),
        withTiming(-6, { duration: 80 }),
        withTiming(0, { duration: 80 })
      );
    }
  }, [status, shakeX]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // Queue pulse
  const queueOpacity = useSharedValue(1);
  useEffect(() => {
    if (status === 'queued') {
      queueOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 750 }),
          withTiming(1, { duration: 750 })
        ),
        -1,
        false
      );
    }
  }, [status, queueOpacity]);

  const queuePulseStyle = useAnimatedStyle(() => ({
    opacity: queueOpacity.value,
  }));

  // ── Extracting ──

  if (status === 'extracting') {
    const currentPhase = phases[currentPhaseIdx];
    const progressPercent = Math.round(progressFraction * 100);
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <Animated.View style={[styles.iconContainer, rotateStyle]}>
          <Ionicons name={currentPhase.icon as any} size={48} color={currentPhase.iconColor} />
        </Animated.View>

        <Text style={styles.title}>Extrayendo elementos...</Text>
        <Text style={styles.url} numberOfLines={1}>{url}</Text>

        <Text style={styles.elapsed}>{formatElapsed(elapsedSeconds)}</Text>

        {/* Deterministic progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressBarDeterministic, { width: `${progressPercent}%` }]} />
        </View>

        {/* Estimated time */}
        <Text style={styles.estimateText}>
          ~{formatElapsed(totalEstimate)} estimado  ·  {progressPercent}%
        </Text>

        {/* Phase timeline */}
        <View style={styles.phaseList}>
          {phases.map((phase, i) => {
            const isDone = i < currentPhaseIdx;
            const isCurrent = i === currentPhaseIdx;
            return (
              <View key={i} style={styles.phaseRow}>
                <Ionicons
                  name={isDone ? 'checkmark-circle' : (isCurrent ? phase.icon : 'ellipse-outline') as any}
                  size={16}
                  color={isDone ? colors.success : isCurrent ? phase.iconColor : colors.bgTertiary}
                />
                <View style={styles.phaseLabelContainer}>
                  <Text
                    style={[
                      styles.phaseLabel,
                      isDone && styles.phaseDone,
                      isCurrent && styles.phaseCurrent,
                    ]}
                    numberOfLines={1}
                  >
                    {phase.label}
                  </Text>
                  {isCurrent && phase.detail && (
                    <Text style={styles.phaseDetail} numberOfLines={1}>{phase.detail}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.singleAction}>
          <Button title="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
      </Animated.View>
    );
  }

  // ── Queued ──

  if (status === 'queued') {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <Animated.View style={[styles.iconContainer, queuePulseStyle]}>
          <Ionicons name="time-outline" size={48} color={colors.warning} />
        </Animated.View>

        <Text style={styles.title}>En cola de espera</Text>

        {queuePosition != null && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>Posicion #{queuePosition}</Text>
          </View>
        )}

        {estimatedWaitSeconds != null && (
          <Text style={styles.subtitle}>
            Tiempo estimado: ~{formatElapsed(estimatedWaitSeconds)}
          </Text>
        )}

        <Text style={styles.elapsed}>{formatElapsed(elapsedSeconds)}</Text>

        <View style={styles.singleAction}>
          <Button title="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
      </Animated.View>
    );
  }

  // ── Success ──

  if (status === 'success') {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
        <Animated.View style={[styles.iconContainer, successStyle]}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
        </Animated.View>

        <Text style={[styles.title, { color: colors.success }]}>
          Extraccion completada
        </Text>
        <Text style={styles.subtitle}>Redirigiendo...</Text>
      </Animated.View>
    );
  }

  // ── Error ──

  // Parse error for structured display
  const parsed = parseError(
    errorCode === 'queue_full'
      ? 'El servidor esta ocupado. Intenta de nuevo en unos momentos.'
      : errorCode === 'pool_timeout'
      ? 'La extraccion tardo demasiado. Intenta con una pagina mas simple.'
      : errorMessage || '',
    errorCode,
  );

  const errMeta = ERROR_TYPE_META[parsed.errorType];

  // Build phase timeline for error display (show which steps passed/failed)
  const errorPhases = preSteps && preSteps.length > 0 ? buildPhases(preSteps) : null;
  const failedPhaseIdx = parsed.stepIndex != null ? parsed.stepIndex - 1 : // backend is 1-indexed
    parsed.category === 'navigation' ? preStepCount :
    parsed.category === 'extraction' ? preStepCount + 2 :
    undefined;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <Animated.View style={[styles.iconContainer, shakeStyle]}>
        <Ionicons name="alert-circle" size={56} color={colors.danger} />
      </Animated.View>

      <Text style={[styles.title, { color: colors.danger }]}>
        {CATEGORY_LABEL[parsed.category]}
      </Text>

      {/* Error breakdown card */}
      <View style={styles.errorCard}>
        {/* Error type badge */}
        <View style={styles.errorTypeRow}>
          <View style={[styles.errorTypeBadge, { backgroundColor: errMeta.color + '20' }]}>
            <Ionicons name={errMeta.icon as any} size={14} color={errMeta.color} />
            <Text style={[styles.errorTypeBadgeText, { color: errMeta.color }]}>{errMeta.label}</Text>
          </View>
        </View>

        {/* Failed step info */}
        {parsed.category === 'pre-step' && (
          <View style={styles.errorStepInfo}>
            {parsed.stepIndex != null && (
              <View style={styles.errorStepRow}>
                <Text style={styles.errorStepLabel}>Step:</Text>
                <Text style={styles.errorStepValue}>#{parsed.stepIndex}</Text>
                {parsed.action && (
                  <View style={[styles.errorActionBadge, { backgroundColor: (ACTION_META[parsed.action]?.bg || colors.bgTertiary) }]}>
                    <Ionicons name={(ACTION_META[parsed.action]?.icon || 'ellipse') as any} size={11} color={ACTION_META[parsed.action]?.color || colors.textSecondary} />
                    <Text style={[styles.errorActionText, { color: ACTION_META[parsed.action]?.color || colors.textSecondary }]}>{parsed.action}</Text>
                  </View>
                )}
              </View>
            )}
            {parsed.selector && (
              <View style={styles.errorStepRow}>
                <Text style={styles.errorStepLabel}>Selector:</Text>
                <Text style={styles.errorSelectorValue} numberOfLines={1}>{parsed.selector}</Text>
              </View>
            )}
          </View>
        )}

        {/* Suggestion */}
        <View style={styles.errorSuggestionRow}>
          <Ionicons name="bulb-outline" size={14} color={colors.warning} />
          <Text style={styles.errorSuggestion}>{parsed.suggestion}</Text>
        </View>
      </View>

      {/* Phase timeline with pass/fail indicators */}
      {errorPhases && failedPhaseIdx != null && failedPhaseIdx >= 0 && (
        <View style={styles.errorPhaseList}>
          {errorPhases.map((phase, i) => {
            const passed = i < failedPhaseIdx;
            const failed = i === failedPhaseIdx;
            const pending = i > failedPhaseIdx;
            return (
              <View key={i} style={styles.phaseRow}>
                <Ionicons
                  name={passed ? 'checkmark-circle' : failed ? 'close-circle' : 'ellipse-outline' as any}
                  size={14}
                  color={passed ? colors.success : failed ? colors.danger : colors.bgTertiary}
                />
                <Text
                  style={[
                    styles.errorPhaseLabel,
                    passed && { color: colors.success, textDecorationLine: 'line-through' },
                    failed && { color: colors.danger, fontWeight: '600' },
                    pending && { color: colors.bgTertiary },
                  ]}
                  numberOfLines={1}
                >
                  {phase.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Raw message collapsible (for advanced users) */}
      {parsed.rawMessage && parsed.category !== 'unknown' && (
        <Text style={styles.errorRawMessage} numberOfLines={2}>
          {parsed.rawMessage}
        </Text>
      )}

      {/* If unknown error, just show the raw message prominently */}
      {parsed.category === 'unknown' && (
        <Text style={styles.errorMessage}>
          {parsed.rawMessage || 'Ocurrio un error inesperado.'}
        </Text>
      )}

      <View style={styles.errorActions}>
        <Button title="Volver" variant="secondary" onPress={onCancel} />
        <Button title="Reintentar" variant="primary" onPress={onRetry} />
      </View>
    </Animated.View>
  );
}

export const ExtractionProgressView = React.memo(ExtractionProgressViewInner);

// ── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  url: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    fontFamily: fonts.mono,
    marginBottom: spacing.md,
    maxWidth: '100%',
    textAlign: 'center',
  },
  elapsed: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xxl,
    fontWeight: '300',
    fontFamily: fonts.mono,
    marginBottom: spacing.lg,
  },

  // Deterministic progress bar
  progressTrack: {
    width: '80%',
    height: 4,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBarDeterministic: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },

  // Estimate
  estimateText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginBottom: spacing.lg,
  },

  // Phase list
  phaseList: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    gap: 6,
    marginBottom: spacing.lg,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  phaseLabelContainer: {
    flex: 1,
  },
  phaseLabel: {
    flex: 1,
    color: colors.bgTertiary,
    fontSize: fonts.sizes.xs,
  },
  phaseDone: {
    color: colors.success,
    textDecorationLine: 'line-through',
  },
  phaseCurrent: {
    color: colors.text,
    fontWeight: '600',
  },
  phaseDetail: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: fonts.mono,
    marginTop: 1,
  },

  // Queue
  queueBadge: {
    backgroundColor: '#9e6a03',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  queueBadgeText: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
  },

  // Error card
  errorCard: {
    width: '100%',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorTypeRow: {
    flexDirection: 'row',
  },
  errorTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  errorTypeBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  errorStepInfo: {
    gap: 6,
  },
  errorStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorStepLabel: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    fontWeight: '500',
  },
  errorStepValue: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
    fontFamily: fonts.mono,
  },
  errorActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  errorActionText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  errorSelectorValue: {
    flex: 1,
    color: colors.primary,
    fontSize: fonts.sizes.xs,
    fontFamily: fonts.mono,
  },
  errorSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorSuggestion: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    lineHeight: 16,
  },

  // Error phase timeline
  errorPhaseList: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    gap: 4,
    marginBottom: spacing.md,
  },
  errorPhaseLabel: {
    flex: 1,
    fontSize: fonts.sizes.xs,
    color: colors.textTertiary,
  },

  // Raw error message
  errorRawMessage: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: fonts.mono,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    opacity: 0.7,
  },

  errorMessage: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },

  singleAction: {
    marginTop: spacing.sm,
  },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
