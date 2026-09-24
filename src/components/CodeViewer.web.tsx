import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import { useToastStore } from '../stores/toast';
import { colors, fonts, radius, spacing } from '../theme';

const LANG_MAP: Record<string, string> = {
  python: 'python',
  java: 'java',
  go: 'go',
  csharp: 'csharp',
  cs: 'csharp',
  'c#': 'csharp',
};

interface Props {
  code: string;
  language?: string;
}

export const CodeViewer = memo(function CodeViewer({ code, language }: Props) {
  const toast = useToastStore((s) => s.show);
  const resolvedLang = language ? LANG_MAP[language.toLowerCase()] || language.toLowerCase() : 'text';

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('success', 'Copied to clipboard');
    } catch {
      toast('error', 'Failed to copy');
    }
  }, [code, toast]);

  const displayLang = resolvedLang === 'csharp' ? 'C#' : resolvedLang;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.lang}>{displayLang}</Text>
        <Pressable onPress={copyToClipboard} style={styles.actionBtn}>
          <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.actionText}>Copy</Text>
        </Pressable>
      </View>
      <SyntaxHighlighter
        language={resolvedLang}
        style={vscDarkPlus}
        showLineNumbers
        customStyle={webCustomStyle}
        codeTagProps={{ style: { fontSize: 13, fontFamily: 'monospace' } }}
        lineNumberStyle={lineNumberStyle}
      >
        {code}
      </SyntaxHighlighter>
    </View>
  );
});

const webCustomStyle = {
  margin: 0,
  padding: 16,
  backgroundColor: colors.syntaxBg,
  borderRadius: 0,
  maxHeight: 500,
  overflow: 'auto' as const,
};

const lineNumberStyle = {
  color: colors.syntaxGutter,
  fontSize: 12,
  minWidth: 32,
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.syntaxBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgTertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lang: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
  },
});
