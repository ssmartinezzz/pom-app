import { memo, useCallback } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '../stores/toast';
import { colors, fonts, radius, spacing } from '../theme';

const LANG_MAP: Record<string, string> = {
  python: 'python',
  java: 'java',
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
      await Clipboard.setStringAsync(code);
      toast('success', 'Copied to clipboard');
    } catch {
      toast('error', 'Failed to copy');
    }
  }, [code, toast]);

  const shareCode = useCallback(async () => {
    try {
      await Share.share({ message: code });
    } catch {
      // cancelled
    }
  }, [code]);

  const displayLang = resolvedLang === 'csharp' ? 'C#' : resolvedLang;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.lang}>{displayLang}</Text>
        <View style={styles.actions}>
          <Pressable onPress={copyToClipboard} style={styles.actionBtn}>
            <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.actionText}>Copy</Text>
          </Pressable>
          <Pressable onPress={shareCode} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal style={styles.scroll}>
        <ScrollView nestedScrollEnabled style={styles.codeScroll}>
          <Text style={styles.code} selectable>
            {code}
          </Text>
        </ScrollView>
      </ScrollView>
    </View>
  );
});

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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
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
  scroll: {
    maxHeight: 500,
  },
  codeScroll: {
    padding: spacing.md,
  },
  code: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
});
