import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProjectsStore } from '../../src/stores/projects';
import { useToastStore } from '../../src/stores/toast';
import { ProjectCard } from '../../src/components/ProjectCard';
import { LanguagePicker } from '../../src/components/LanguagePicker';
import { Button, Input, EmptyState, AnimatedListItem, LoadingSkeletonList } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { BrowserType, ProjectSummary, ProjectType } from '../../src/types';

export default function ProjectsScreen() {
  const { projects, isLoading, fetchProjects, createProject } = useProjectsStore();
  const toast = useToastStore((s) => s.show);
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [languageId, setLanguageId] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('web');
  const [browser, setBrowser] = useState<BrowserType>('chromium');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchProjects()
        .catch((err: any) => {
          toast('error', err?.response?.data?.error || 'Failed to load projects');
        })
        .finally(() => setInitialLoad(false));
    }, [fetchProjects, toast])
  );

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!baseUrl.trim()) {
      setError('Base URL is required');
      return;
    }
    if (!languageId) {
      setError('Select a language');
      return;
    }
    setCreating(true);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim(),
        base_url: baseUrl.trim(),
        language_id: languageId,
        project_type: projectType,
        browser: projectType === 'web' ? browser : undefined,
      });
      setShowCreate(false);
      resetForm();
      toast('success', `Project "${project.name}" created`);
      router.push(`/project/${project.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setBaseUrl('');
    setLanguageId('');
    setProjectType('web');
    setBrowser('chromium');
    setError('');
  };

  const handleProjectPress = useCallback(
    (item: ProjectSummary) => {
      router.push(`/project/${item.id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ProjectSummary; index: number }) => (
      <AnimatedListItem index={index}>
        <ProjectCard
          project={item}
          onPress={() => handleProjectPress(item)}
        />
      </AnimatedListItem>
    ),
    [handleProjectPress],
  );

  return (
    <View style={styles.container}>
      {initialLoad && isLoading ? (
        <LoadingSkeletonList count={4} />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && !initialLoad}
              onRefresh={fetchProjects}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="folder-open-outline"
              title="No projects yet"
              subtitle="Create your first project to start extracting page elements"
              actionLabel="Create project"
              onAction={() => setShowCreate(true)}
            />
          }
        />
      )}

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => setShowCreate(true)}
        disabled={showCreate}
      >
        <Ionicons name="add" size={28} color={colors.text} />
      </Pressable>

      {/* Create Project Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Project</Text>
              <Pressable onPress={() => { setShowCreate(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Project Type Selector */}
              <View style={styles.typeSelector}>
                <Text style={styles.typeLabel}>Project Type</Text>
                <View style={styles.typeChips}>
                  <Pressable
                    onPress={() => setProjectType('web')}
                    style={[styles.typeChip, projectType === 'web' && styles.typeChipSelected]}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={16}
                      color={projectType === 'web' ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.typeChipText, projectType === 'web' && styles.typeChipTextSelected]}>
                      Web POM
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setProjectType('api')}
                    style={[styles.typeChip, projectType === 'api' && styles.typeChipSelected]}
                  >
                    <Ionicons
                      name="cloud-outline"
                      size={16}
                      color={projectType === 'api' ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.typeChipText, projectType === 'api' && styles.typeChipTextSelected]}>
                      API Testing
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Browser Selector — only for Web projects */}
              {projectType === 'web' && (
                <View style={styles.typeSelector}>
                  <Text style={styles.typeLabel}>Browser</Text>
                  <View style={styles.typeChips}>
                    <Pressable
                      onPress={() => setBrowser('chromium')}
                      style={[styles.typeChip, browser === 'chromium' && styles.typeChipSelected]}
                    >
                      <Ionicons
                        name="logo-chrome"
                        size={16}
                        color={browser === 'chromium' ? colors.primary : colors.textTertiary}
                      />
                      <Text style={[styles.typeChipText, browser === 'chromium' && styles.typeChipTextSelected]}>
                        Chromium
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setBrowser('firefox')}
                      style={[styles.typeChip, browser === 'firefox' && styles.typeChipSelected]}
                    >
                      <Ionicons
                        name="logo-firefox"
                        size={16}
                        color={browser === 'firefox' ? colors.primary : colors.textTertiary}
                      />
                      <Text style={[styles.typeChipText, browser === 'firefox' && styles.typeChipTextSelected]}>
                        Firefox
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setBrowser('webkit')}
                      style={[styles.typeChip, browser === 'webkit' && styles.typeChipSelected]}
                    >
                      <Ionicons
                        name="compass-outline"
                        size={16}
                        color={browser === 'webkit' ? colors.primary : colors.textTertiary}
                      />
                      <Text style={[styles.typeChipText, browser === 'webkit' && styles.typeChipTextSelected]}>
                        WebKit
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder={projectType === 'web' ? 'My Website Tests' : 'My API Tests'}
              />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                multiline
              />
              <Input
                label="Base URL"
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder={projectType === 'web' ? 'https://example.com' : 'https://api.example.com'}
                keyboardType="url"
                autoCapitalize="none"
              />
              <LanguagePicker selectedId={languageId} onSelect={setLanguageId} />

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => { setShowCreate(false); resetForm(); }}
              />
              <Button
                title="Create"
                onPress={handleCreate}
                loading={creating}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  typeSelector: {
    marginBottom: spacing.md,
  },
  typeLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  typeChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  typeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark + '22',
  },
  typeChipText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  typeChipTextSelected: {
    color: colors.primary,
  },
});
