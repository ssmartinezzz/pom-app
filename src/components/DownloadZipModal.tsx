import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}

export function DownloadZipModal({ visible, onClose, onDownload, downloading }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="download-outline" size={20} color={colors.primary} />
              <Text style={styles.title}>Download ZIP</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.description}>
            Download the generated project as a ZIP file with all page objects, tests, and scaffold.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnPrimary, downloading && styles.btnDisabled]}
              onPress={onDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="download-outline" size={16} color={colors.text} />
                  <Text style={styles.btnText}>Download ZIP</Text>
                </View>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: '600',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  btn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  btnPrimary: {
    backgroundColor: colors.primaryDark,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  btnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '600',
    color: colors.text,
  },
});
