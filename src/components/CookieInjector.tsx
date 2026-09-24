import { memo, useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '../theme';
import { InjectCookie } from '../types';

interface Props {
  targetUrl: string;
  onCookiesChange: (cookies: InjectCookie[]) => void;
}

type TabMode = 'paste' | 'manual';

interface ManualRow {
  id: string;
  name: string;
  value: string;
  domain: string;
}

let _rid = 0;
const rid = () => `cr_${++_rid}_${Date.now()}`;

/** Extract domain from a URL string (e.g. "https://app.example.com/foo" → ".app.example.com") */
function domainFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.startsWith('.') ? host : `.${host}`;
  } catch {
    return '';
  }
}

/** Parse a "Cookie: k=v; k2=v2" header string into InjectCookie[] */
function parseCookieHeader(raw: string, defaultDomain: string): InjectCookie[] {
  // Strip "Cookie:" prefix if present
  let str = raw.trim();
  if (/^cookie\s*:/i.test(str)) {
    str = str.replace(/^cookie\s*:\s*/i, '');
  }
  if (!str) return [];

  return str
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return null;
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      if (!name) return null;
      return { name, value, domain: defaultDomain } as InjectCookie;
    })
    .filter((c): c is InjectCookie => c !== null);
}

function CookieInjectorInner({ targetUrl, onCookiesChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<TabMode>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parsedFromPaste, setParsedFromPaste] = useState<InjectCookie[]>([]);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);

  const defaultDomain = domainFromUrl(targetUrl);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const totalCount = tab === 'paste' ? parsedFromPaste.length : manualRows.filter((r) => r.name && r.value).length;

  // ── Paste tab ──
  const handlePasteChange = useCallback(
    (text: string) => {
      setPasteText(text);
      const cookies = parseCookieHeader(text, defaultDomain);
      setParsedFromPaste(cookies);
      onCookiesChange(cookies);
    },
    [defaultDomain, onCookiesChange],
  );

  // ── Manual tab ──
  const addRow = useCallback(() => {
    const newRow: ManualRow = { id: rid(), name: '', value: '', domain: defaultDomain };
    setManualRows((prev) => [...prev, newRow]);
  }, [defaultDomain]);

  const updateRow = useCallback(
    (id: string, field: keyof ManualRow, val: string) => {
      setManualRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, [field]: val } : r));
        const cookies: InjectCookie[] = next
          .filter((r) => r.name && r.value)
          .map((r) => ({ name: r.name, value: r.value, domain: r.domain || defaultDomain }));
        onCookiesChange(cookies);
        return next;
      });
    },
    [defaultDomain, onCookiesChange],
  );

  const removeRow = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setManualRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        const cookies: InjectCookie[] = next
          .filter((r) => r.name && r.value)
          .map((r) => ({ name: r.name, value: r.value, domain: r.domain || defaultDomain }));
        onCookiesChange(cookies);
        return next;
      });
    },
    [defaultDomain, onCookiesChange],
  );

  const switchTab = useCallback(
    (newTab: TabMode) => {
      setTab(newTab);
      // Clear other tab's data
      if (newTab === 'paste') {
        setManualRows([]);
        onCookiesChange(parsedFromPaste);
      } else {
        setPasteText('');
        setParsedFromPaste([]);
        const cookies: InjectCookie[] = manualRows
          .filter((r) => r.name && r.value)
          .map((r) => ({ name: r.name, value: r.value, domain: r.domain || defaultDomain }));
        onCookiesChange(cookies);
      }
    },
    [defaultDomain, manualRows, onCookiesChange, parsedFromPaste],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable style={styles.header} onPress={toggle}>
        <View style={styles.headerLeft}>
          <Ionicons name="key-outline" size={16} color={colors.primary} />
          <Text style={styles.headerTitle}>Cookie Injection</Text>
          {totalCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalCount}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, tab === 'paste' && styles.tabActive]}
              onPress={() => switchTab('paste')}
            >
              <Text style={[styles.tabText, tab === 'paste' && styles.tabTextActive]}>
                Quick Paste
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'manual' && styles.tabActive]}
              onPress={() => switchTab('manual')}
            >
              <Text style={[styles.tabText, tab === 'manual' && styles.tabTextActive]}>
                Manual
              </Text>
            </Pressable>
          </View>

          {tab === 'paste' ? (
            <View>
              {/* Tip */}
              <View style={styles.tip}>
                <Ionicons name="bulb-outline" size={14} color={colors.warning} />
                <Text style={styles.tipText}>
                  Open DevTools → Network tab → click any request → copy the Cookie header value
                </Text>
              </View>
              <TextInput
                style={styles.textarea}
                value={pasteText}
                onChangeText={handlePasteChange}
                placeholder="Cookie: session=abc123; token=xyz789"
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {parsedFromPaste.length > 0 && (
                <Text style={styles.parseResult}>
                  {parsedFromPaste.length} cookie{parsedFromPaste.length !== 1 ? 's' : ''} parsed
                  {defaultDomain ? ` → domain: ${defaultDomain}` : ''}
                </Text>
              )}
            </View>
          ) : (
            <View>
              {manualRows.map((row) => (
                <View key={row.id} style={styles.manualRow}>
                  <View style={styles.manualFields}>
                    <TextInput
                      style={[styles.manualInput, styles.manualName]}
                      value={row.name}
                      onChangeText={(v) => updateRow(row.id, 'name', v)}
                      placeholder="name"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TextInput
                      style={[styles.manualInput, styles.manualValue]}
                      value={row.value}
                      onChangeText={(v) => updateRow(row.id, 'value', v)}
                      placeholder="value"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TextInput
                      style={[styles.manualInput, styles.manualDomain]}
                      value={row.domain}
                      onChangeText={(v) => updateRow(row.id, 'domain', v)}
                      placeholder="domain"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Pressable style={styles.removeBtn} onPress={() => removeRow(row.id)}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addBtn} onPress={addRow}>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.addBtnText}>Add cookie</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export const CookieInjector = memo(CookieInjectorInner);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.regular,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgSecondary,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  tabActive: {
    backgroundColor: colors.bgSecondary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  tabTextActive: {
    color: colors.text,
    fontFamily: fonts.regular,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: spacing.sm,
    padding: spacing.xs,
    backgroundColor: `${colors.warning}10`,
    borderRadius: radius.sm,
  },
  tipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.regular,
    flex: 1,
    lineHeight: 16,
  },
  textarea: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontFamily: fonts.mono || fonts.regular,
    fontSize: 12,
    padding: spacing.sm,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  parseResult: {
    color: colors.success,
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 4,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: 4,
  },
  manualFields: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  manualInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.regular,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  manualName: {
    flex: 2,
  },
  manualValue: {
    flex: 3,
  },
  manualDomain: {
    flex: 2,
  },
  removeBtn: {
    padding: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
  },
  addBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: fonts.regular,
  },
});
