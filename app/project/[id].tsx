import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useProjectsStore } from '../../src/stores/projects';
import { useToastStore } from '../../src/stores/toast';
import { ExtractionItem } from '../../src/components/ExtractionItem';
import { FolderCard } from '../../src/components/FolderCard';
import { GenerationItem } from '../../src/components/GenerationItem';
import { AnalysisItem } from '../../src/components/AnalysisItem';
import { PreStepsConfig } from '../../src/components/AuthStepsConfig';
import { DownloadZipModal } from '../../src/components/DownloadZipModal';
import { CookieInjector } from '../../src/components/CookieInjector';
import { ExtractionProgressView } from '../../src/components/ExtractionProgressView';
import { CodeViewer } from '../../src/components/CodeViewer';
import { Button, Input, Badge, EmptyState, AnimatedListItem, LoadingSkeletonList } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';
import { formatDate, formatUrl } from '../../src/utils/format';
import { getToken } from '../../src/utils/storage';
import * as languagesApi from '../../src/api/languages';
import { useLanguagesStore } from '../../src/stores/languages';
import { LanguageIcon } from '../../src/components/LanguageIcon';
import {
  getInstallScript, getGitignore, getReadme, getProjectTree,
  getBddFrameworkInfo, getBddRunCommand, getBddConfigPreview,
  getBddStepsPreview, getBddHooksPreview,
  getApiProjectTree, getApiInstallScript, getApiReadme, getApiBaseClient,
  getApiGitignore, getApiDockerfile, getApiCiWorkflow, getApiEnvExample, getApiConftest,
} from '../../src/utils/framework';
import { EndpointItem } from '../../src/components/EndpointItem';
import { EndpointForm } from '../../src/components/EndpointForm';
import { Project, ExtractionSummary, GenerationSummary, AnalysisSummary, ApiEndpointSummary, AuthStep, InjectCookie, Template, FolderSummary } from '../../src/types';

type Tab = 'extractions' | 'generations' | 'analyses' | 'framework' | 'endpoints';

const SCAFFOLD_TYPES = ['base_page', 'base_test', 'config', 'runner'];

const TEST_RUNNERS: Record<string, string> = {
  python: 'pytest',
  java: 'TestNG',
  go: 'testing',
  csharp: 'NUnit',
};

function getLangFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'java': return 'java';
    case 'go': return 'go';
    case 'cs': return 'csharp';
    case 'xml': return 'xml';
    case 'mod': return 'go';
    default: return 'text';
  }
}

const PAGE_LIMIT = 20;

function RootDropZone({ onDrop, dataKey = 'extractionId' }: { onDrop: (itemId: string) => void; dataKey?: string }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }}
      onDragEnter={(e: any) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: any) => {
        e.preventDefault();
        setOver(false);
        const itemId = e.dataTransfer.getData(dataKey);
        if (itemId) onDrop(itemId);
      }}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 8,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: over ? colors.primary : colors.border,
        backgroundColor: over ? `${colors.primary}15` : 'transparent',
        marginBottom: 8,
        transition: 'all 0.15s ease',
      }}
    >
      <Ionicons name="home-outline" size={16} color={over ? colors.primary : colors.textTertiary} />
      <Text style={{ color: over ? colors.primary : colors.textTertiary, fontSize: 13 }}>
        Drop here to move to root
      </Text>
    </div>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useProjectsStore();
  const toast = useToastStore((s) => s.show);
  const languagesStore = useLanguagesStore();
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState<Project | null>(null);
  const [extractions, setExtractions] = useState<ExtractionSummary[]>([]);
  const [generations, setGenerations] = useState<GenerationSummary[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('extractions');
  const [downloading, setDownloading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [aiJobStatus, setAiJobStatus] = useState<{
    status: string; current_page: number; total_pages: number; page_name: string; current_task: string; started_at: number;
  } | null>(null);
  const aiPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiAnalyzing = aiJobStatus != null && aiJobStatus.status !== 'idle';
  const [aiElapsed, setAiElapsed] = useState(0);
  const aiElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [aiCommentCode, setAiCommentCode] = useState(false);
  const [aiImproveTests, setAiImproveTests] = useState(false);
  const [aiSelectedPages, setAiSelectedPages] = useState<Set<string>>(new Set());
  const [aiPagesExpanded, setAiPagesExpanded] = useState(false);
  const [aiAllGenerations, setAiAllGenerations] = useState<GenerationSummary[]>([]);
  const [scaffoldTemplates, setScaffoldTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    structure: false,
    quickstart: false,
    bdd: false,
    scaffold: true,
    gitignore: false,
    readme: false,
    baseclient: true,
    conftest: false,
    env: false,
    dockerfile: false,
    ci: false,
  });

  const language = useMemo(
    () => languagesStore.languages.find((l) => l.id === project?.language_id),
    [languagesStore.languages, project?.language_id]
  );

  const toggleSection = useCallback(
    (key: string) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] })),
    []
  );

  // Pagination state per tab
  const [extTotal, setExtTotal] = useState(0);
  const [genTotal, setGenTotal] = useState(0);
  const [anaTotal, setAnaTotal] = useState(0);
  const [endpoints, setEndpoints] = useState<ApiEndpointSummary[]>([]);
  const [endTotal, setEndTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Folder state (independent per tab)
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [extFolder, setExtFolder] = useState<string | null>(null);
  const [genFolder, setGenFolder] = useState<string | null>(null);
  const currentFolder = activeTab === 'generations' ? genFolder : extFolder;
  const setCurrentFolder = activeTab === 'generations' ? setGenFolder : setExtFolder;
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerTarget, setFolderPickerTarget] = useState<string | null>(null);
  const [folderPickerType, setFolderPickerType] = useState<'extraction' | 'generation'>('extraction');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Endpoint form modal
  const [showEndpointForm, setShowEndpointForm] = useState(false);

  // Auth config modal


  // Extract URL modal
  const [showExtract, setShowExtract] = useState(false);
  const [extractMode, setExtractMode] = useState<'url' | 'html'>('url');
  const [showHtmlTip, setShowHtmlTip] = useState(false);
  const [extractUrl, setExtractUrl] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractErrorCode, setExtractErrorCode] = useState('');
  const [extractStatus, setExtractStatus] = useState<'form' | 'extracting' | 'queued' | 'success' | 'error'>('form');
  const [extractElapsed, setExtractElapsed] = useState(0);
  const extractTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authStepsRef = useRef<AuthStep[]>([]);
  const cookiesRef = useRef<InjectCookie[]>([]);

  // Elapsed timer for extraction progress
  useEffect(() => {
    if (extractStatus === 'extracting' || extractStatus === 'queued') {
      setExtractElapsed(0);
      extractTimerRef.current = setInterval(() => {
        setExtractElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (extractTimerRef.current) {
        clearInterval(extractTimerRef.current);
        extractTimerRef.current = null;
      }
    };
  }, [extractStatus]);

  const initialTabSet = useRef(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    languagesStore.fetch();
    try {
      const p = await store.getProject(id);
      setProject(p);

      // Set initial tab based on project type (once)
      if (!initialTabSet.current) {
        initialTabSet.current = true;
        if (p.project_type === 'api') setActiveTab('endpoints');
      }

      if (p.project_type === 'api') {
        // API project: load endpoints
        const end = await store.fetchApiEndpoints(id, { limit: PAGE_LIMIT, offset: 0 });
        setEndpoints(end.data);
        setEndTotal(end.total);
      } else {
        // Web project: load extractions, generations, analyses, folders
        const extFp = extFolder ?? '__none__';
        const genFp = genFolder ?? '__none__';
        const [ext, gen, ana, fld] = await Promise.all([
          store.fetchExtractions(id, { limit: PAGE_LIMIT, offset: 0, folder: extFp }),
          store.fetchGenerations(id, { limit: PAGE_LIMIT, offset: 0, folder: genFp }),
          store.fetchAnalyses(id, { limit: PAGE_LIMIT, offset: 0 }),
          store.fetchFolders(id),
        ]);
        setExtractions(ext.data);
        setExtTotal(ext.total);
        setGenerations(gen.data);
        setGenTotal(gen.total);
        setAnalyses(ana.data);
        setAnaTotal(ana.total);
        setFolders(fld);
      }

      // Fetch scaffold templates for this project's language
      if (p.language_id) {
        setTemplatesLoading(true);
        languagesApi.getLanguageTemplates(p.language_id)
          .then((tpls) => {
            const scaffold = tpls
              .filter((t) => SCAFFOLD_TYPES.includes(t.template_type))
              .sort((a, b) => SCAFFOLD_TYPES.indexOf(a.template_type) - SCAFFOLD_TYPES.indexOf(b.template_type));
            setScaffoldTemplates(scaffold);
          })
          .catch(() => {})
          .finally(() => setTemplatesLoading(false));
      }
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to load project');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, store, toast, languagesStore]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Reload extractions when navigating into/out of a folder
  const extFolderInit = useRef(false);
  useEffect(() => {
    if (!extFolderInit.current) { extFolderInit.current = true; return; }
    if (!id) return;
    const fp = extFolder ?? '__none__';
    store.fetchExtractions(id, { limit: PAGE_LIMIT, offset: 0, folder: fp })
      .then((res) => { setExtractions(res.data); setExtTotal(res.total); })
      .catch(() => {});
  }, [extFolder]);

  // Reload generations when navigating into/out of a folder
  const genFolderInit = useRef(false);
  useEffect(() => {
    if (!genFolderInit.current) { genFolderInit.current = true; return; }
    if (!id) return;
    const fp = genFolder ?? '__none__';
    store.fetchGenerations(id, { limit: PAGE_LIMIT, offset: 0, folder: fp })
      .then((res) => { setGenerations(res.data); setGenTotal(res.total); })
      .catch(() => {});
  }, [genFolder]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Infinite scroll ──

  const handleLoadMore = useCallback(async () => {
    if (!id || loadingMore) return;

    let currentLen: number;
    let total: number;

    if (activeTab === 'endpoints') {
      currentLen = endpoints.length;
      total = endTotal;
    } else if (activeTab === 'extractions') {
      currentLen = extractions.length;
      total = extTotal;
    } else if (activeTab === 'generations') {
      currentLen = generations.length;
      total = genTotal;
    } else {
      currentLen = analyses.length;
      total = anaTotal;
    }

    if (currentLen >= total) return;

    setLoadingMore(true);
    try {
      if (activeTab === 'endpoints') {
        const res = await store.fetchApiEndpoints(id, { limit: PAGE_LIMIT, offset: currentLen });
        setEndpoints((prev) => [...prev, ...res.data]);
        setEndTotal(res.total);
      } else if (activeTab === 'extractions') {
        const fp = extFolder ?? '__none__';
        const res = await store.fetchExtractions(id, { limit: PAGE_LIMIT, offset: currentLen, folder: fp });
        setExtractions((prev) => [...prev, ...res.data]);
        setExtTotal(res.total);
      } else if (activeTab === 'generations') {
        const fp = genFolder ?? '__none__';
        const res = await store.fetchGenerations(id, { limit: PAGE_LIMIT, offset: currentLen, folder: fp });
        setGenerations((prev) => [...prev, ...res.data]);
        setGenTotal(res.total);
      } else {
        const res = await store.fetchAnalyses(id, { limit: PAGE_LIMIT, offset: currentLen });
        setAnalyses((prev) => [...prev, ...res.data]);
        setAnaTotal(res.total);
      }
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false);
    }
  }, [id, activeTab, endpoints.length, extractions.length, generations.length, analyses.length, endTotal, extTotal, genTotal, anaTotal, loadingMore, store]);

  const hasMore = useMemo(() => {
    if (activeTab === 'endpoints') return endpoints.length < endTotal;
    if (activeTab === 'extractions') return extractions.length < extTotal;
    if (activeTab === 'generations') return generations.length < genTotal;
    return analyses.length < anaTotal;
  }, [activeTab, endpoints.length, extractions.length, generations.length, analyses.length, endTotal, extTotal, genTotal, anaTotal]);

  // ── Handlers ──

  const handleExtract = async () => {
    setExtractError('');
    setExtractErrorCode('');
    const url = extractUrl.trim() || project?.base_url || '';
    if (!url) {
      setExtractError('URL is required');
      return;
    }
    setExtracting(true);
    setExtractStatus('extracting');
    try {
      const steps = authStepsRef.current.length > 0 ? authStepsRef.current : undefined;
      const cookies = cookiesRef.current.length > 0 ? cookiesRef.current : undefined;
      const { extraction_id: extractionId, warnings } = await store.extractUrl(url, id!, steps, cookies);
      setExtractStatus('success');
      // Brief success state before navigating
      setTimeout(() => {
        setShowExtract(false);
        setExtractUrl('');
        setExtractStatus('form');
        authStepsRef.current = [];
        cookiesRef.current = [];
        setExtracting(false);
        if (warnings && warnings.length > 0) {
          toast('warning', warnings.join('\n'));
        }
        router.push(`/extraction/${extractionId}?projectId=${id}`);
      }, 1200);
    } catch (err: any) {
      const code = err?.response?.data?.code || '';
      const message = err?.response?.data?.error || 'Extraction failed';
      setExtractError(message);
      setExtractErrorCode(code);
      setExtractStatus('error');
      setExtracting(false);
    }
  };

  const handleExtractCancel = () => {
    setShowExtract(false);
    setExtractStatus('form');
    setExtracting(false);
    setExtractError('');
    setExtractErrorCode('');
  };

  const handleExtractRetry = () => {
    setExtractStatus('form');
    setExtractError('');
    setExtractErrorCode('');
  };

  const handleExtractHtml = async () => {
    setExtractError('');
    const html = htmlInput.trim();
    if (!html) {
      setExtractError('HTML content is required');
      return;
    }
    const url = extractUrl.trim() || project?.base_url || 'manual://pasted-html';
    setExtracting(true);
    try {
      const { extraction_id: extractionId, element_count } = await store.extractFromHtml(html, url, id!);
      toast('success', `Extracted ${element_count} elements from pasted HTML`);
      setShowExtract(false);
      setExtractUrl('');
      setHtmlInput('');
      setExtractMode('url');
      setExtracting(false);
      router.push(`/extraction/${extractionId}?projectId=${id}`);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Extraction failed';
      setExtractError(message);
      setExtracting(false);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Delete this project? This action cannot be undone.')) return;
      doDelete();
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Delete Project', 'This will permanently delete this project and all its data.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const doDelete = async () => {
    try {
      await store.deleteProject(id!);
      toast('success', 'Project deleted');
      router.canGoBack() ? router.back() : router.replace('/(tabs)');
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to delete project');
    }
  };

  // Poll AI job status when screen is focused
  const pollAiStatus = useCallback(async () => {
    if (!id) return;
    try {
      const { api } = await import('../../src/api/client');
      const { data } = await api.get(`/projects/${id}/ai-analyze/status`);
      setAiJobStatus(data);
      if (data.status !== 'idle') {
        // Also refresh analyses list to show new results
        const anaRes = await store.fetchAnalyses(id, { limit: 20, offset: 0 });
        setAnalyses(anaRes.data);
        setAnaTotal(anaRes.total);
      }
    } catch {
      setAiJobStatus(null);
    }
  }, [id]);

  // On focus: check status immediately and start polling; on blur: stop
  useFocusEffect(
    useCallback(() => {
      pollAiStatus();
      aiPollTimerRef.current = setInterval(pollAiStatus, 8000);
      return () => {
        if (aiPollTimerRef.current) {
          clearInterval(aiPollTimerRef.current);
          aiPollTimerRef.current = null;
        }
      };
    }, [pollAiStatus])
  );

  // Elapsed timer — ticks every second while analyzing
  useEffect(() => {
    if (aiAnalyzing && aiJobStatus?.started_at) {
      setAiElapsed(Math.floor(Date.now() / 1000) - aiJobStatus.started_at);
      aiElapsedRef.current = setInterval(() => {
        setAiElapsed(Math.floor(Date.now() / 1000) - aiJobStatus.started_at);
      }, 1000);
    } else {
      setAiElapsed(0);
      if (aiElapsedRef.current) {
        clearInterval(aiElapsedRef.current);
        aiElapsedRef.current = null;
      }
    }
    return () => {
      if (aiElapsedRef.current) {
        clearInterval(aiElapsedRef.current);
        aiElapsedRef.current = null;
      }
    };
  }, [aiAnalyzing, aiJobStatus?.started_at]);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const taskLabel = (task: string) => {
    switch (task) {
      case 'preparing': return 'Preparing prompt';
      case 'calling_ollama': return 'Waiting for Ollama';
      case 'saving': return 'Saving results';
      default: return 'Processing';
    }
  };

  const handleAiAnalyze = async () => {
    if (!id) return;
    try {
      const { api } = await import('../../src/api/client');
      const payload: Record<string, any> = {
        comment_code: aiCommentCode,
        improve_tests: aiImproveTests,
      };
      if (aiSelectedPages.size > 0) {
        payload.generation_ids = Array.from(aiSelectedPages);
      }
      const { data: aiResult } = await api.post(`/projects/${id}/ai-analyze`, payload, { timeout: 30000 });
      const pagesCount = aiResult?.pages_count ?? 0;
      toast('success', `Analysis started for ${pagesCount} page${pagesCount !== 1 ? 's' : ''}`);
      pollAiStatus();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast('warning', 'Analysis already running');
      } else {
        toast('error', err?.response?.data?.error || 'Failed to start AI analysis');
      }
    }
  };

  const handleCancelAnalysis = async () => {
    if (!id) return;
    try {
      const { api } = await import('../../src/api/client');
      await api.post(`/projects/${id}/ai-analyze/cancel`);
      toast('success', 'Analysis cancelled');
      setAiJobStatus(null);
    } catch {
      toast('warning', 'No analysis running to cancel');
      setAiJobStatus(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const url = store.getDownloadZipUrl(id);
      const token = await getToken();

      if (Platform.OS === 'web') {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `${project?.name || 'project'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
        toast('success', 'ZIP downloaded');
      } else {
        const dest = new File(Paths.cache, `${project?.name || 'project'}-${Date.now()}.zip`);
        // Delete if exists from a previous download
        if (dest.exists) {
          await dest.delete();
        }
        const downloaded = await File.downloadFileAsync(url, dest, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await Sharing.shareAsync(downloaded.uri);
        // Clean up temp file after sharing
        try { await dest.delete(); } catch {}
        toast('success', 'ZIP downloaded');
      }
    } catch (err: any) {
      toast('error', err?.message || 'Failed to download ZIP');
    } finally {
      setDownloading(false);
      setShowDownloadModal(false);
    }
  };

  const handleCreateEndpoint = async (data: any) => {
    await store.createApiEndpoint(id!, data);
    toast('success', 'Endpoint added');
    setShowEndpointForm(false);
    // Reload endpoints
    const res = await store.fetchApiEndpoints(id!, { limit: PAGE_LIMIT, offset: 0 });
    setEndpoints(res.data);
    setEndTotal(res.total);
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Delete this analysis?')) return;
    }
    try {
      await store.deleteAnalysis(id!, analysisId);
      setAnalyses((prev) => prev.filter((a) => a.id !== analysisId));
      setAnaTotal((prev) => prev - 1);
      toast('success', 'Analysis deleted');
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to delete analysis');
    }
  };

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Delete this endpoint?')) return;
    }
    try {
      await store.deleteApiEndpoint(id!, endpointId);
      setEndpoints((prev) => prev.filter((e) => e.id !== endpointId));
      setEndTotal((prev) => prev - 1);
      toast('success', 'Endpoint deleted');
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to delete endpoint');
    }
  };

  // ── Folder handlers ──
  const handleCreateFolder = async () => {
    const name = newFolderName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(name)) {
      toast('error', 'Invalid folder name (lowercase, numbers, hyphens, underscores)');
      return;
    }
    try {
      await store.createFolder(id!, name);
      const fld = await store.fetchFolders(id!);
      setFolders(fld);
      setShowNewFolder(false);
      setNewFolderName('');
      toast('success', `Folder "${name}" created`);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to create folder');
    }
  };

  const handleRenameFolder = async (oldName: string, newName: string) => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(name)) {
      toast('error', 'Invalid folder name');
      return;
    }
    try {
      await store.renameFolder(id!, oldName, name);
      setFolders((prev) => prev.map((f) => f.folder === oldName ? { ...f, folder: name } : f));
      if (extFolder === oldName) setExtFolder(name);
      if (genFolder === oldName) setGenFolder(name);
      toast('success', 'Folder renamed');
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to rename folder');
      throw err;
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Delete folder "${folderName}"? Extractions will be moved to root.`)) return;
    }
    try {
      await store.deleteFolder(id!, folderName);
      setFolders((prev) => prev.filter((f) => f.folder !== folderName));
      if (extFolder === folderName) setExtFolder(null);
      if (genFolder === folderName) setGenFolder(null);
      toast('success', 'Folder deleted, extractions moved to root');
      // Reload extractions & generations (show only root-level after delete)
      const [ext, gen] = await Promise.all([
        store.fetchExtractions(id!, { limit: PAGE_LIMIT, offset: 0, folder: '__none__' }),
        store.fetchGenerations(id!, { limit: PAGE_LIMIT, offset: 0, folder: '__none__' }),
      ]);
      setExtractions(ext.data);
      setExtTotal(ext.total);
      setGenerations(gen.data);
      setGenTotal(gen.total);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to delete folder');
    }
  };

  const handleMoveToFolder = (extractionId: string) => {
    setFolderPickerTarget(extractionId);
    setFolderPickerType('extraction');
    setShowFolderPicker(true);
  };

  const handleMoveGenerationToFolder = (generationId: string) => {
    setFolderPickerTarget(generationId);
    setFolderPickerType('generation');
    setShowFolderPicker(true);
  };

  const handleDropToFolder = async (extractionId: string, folder: string | null) => {
    try {
      await store.updateExtractionFolder(id!, extractionId, folder);
      const [ext, fld] = await Promise.all([
        store.fetchExtractions(id!, { limit: PAGE_LIMIT, offset: 0, folder: extFolder ?? '__none__' }),
        store.fetchFolders(id!),
      ]);
      setExtractions(ext.data);
      setExtTotal(ext.total);
      setFolders(fld);
      toast('success', folder ? `Moved to "${folder}"` : 'Moved to root');
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to move extraction');
    }
  };

  const handleDropGenerationToFolder = async (generationId: string, folder: string | null) => {
    try {
      await store.updateGenerationFolder(id!, generationId, folder);
      const [gen, fld] = await Promise.all([
        store.fetchGenerations(id!, { limit: PAGE_LIMIT, offset: 0, folder: genFolder ?? '__none__' }),
        store.fetchFolders(id!),
      ]);
      setGenerations(gen.data);
      setGenTotal(gen.total);
      setFolders(fld);
      toast('success', folder ? `Moved to "${folder}"` : 'Moved to root');
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to move generation');
    }
  };

  const handleConfirmMoveToFolder = async (folder: string | null) => {
    if (!folderPickerTarget) return;
    try {
      if (folderPickerType === 'generation') {
        await store.updateGenerationFolder(id!, folderPickerTarget, folder);
      } else {
        await store.updateExtractionFolder(id!, folderPickerTarget, folder);
      }
      setShowFolderPicker(false);
      setFolderPickerTarget(null);
      toast('success', folder ? `Moved to "${folder}"` : 'Moved to root');
      // Reload data and folders
      const [ext, gen, fld] = await Promise.all([
        store.fetchExtractions(id!, { limit: PAGE_LIMIT, offset: 0, folder: extFolder ?? '__none__' }),
        store.fetchGenerations(id!, { limit: PAGE_LIMIT, offset: 0, folder: genFolder ?? '__none__' }),
        store.fetchFolders(id!),
      ]);
      setExtractions(ext.data);
      setExtTotal(ext.total);
      setGenerations(gen.data);
      setGenTotal(gen.total);
      setFolders(fld);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to move');
    }
  };

  const isApiProject = project?.project_type === 'api';

  const tabData = useMemo(() => {
    if (activeTab === 'endpoints') return endpoints;
    if (activeTab === 'extractions') {
      // At root level, show folders first then uncategorized extractions
      if (currentFolder === null && folders.length > 0) {
        const folderItems = folders.map((f) => ({ ...f, id: `folder:${f.folder}`, _type: 'folder' as const }));
        const extractionItems = extractions.map((e) => ({ ...e, _type: 'extraction' as const }));
        return [...folderItems, ...extractionItems];
      }
      return extractions;
    }
    if (activeTab === 'generations') {
      if (currentFolder === null && folders.length > 0) {
        const folderItems = folders.map((f) => ({ ...f, id: `folder:${f.folder}`, _type: 'folder' as const }));
        const generationItems = generations.map((g) => ({ ...g, _type: 'generation' as const }));
        return [...folderItems, ...generationItems];
      }
      return generations;
    }
    return analyses;
  }, [activeTab, endpoints, extractions, generations, analyses, folders, extFolder, genFolder]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Loading...</Text>
          </View>
        </View>
        <LoadingSkeletonList count={3} />
      </View>
    );
  }

  if (!project) return <EmptyState title="Project not found" />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Pressable onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </Pressable>
      </View>

      {/* Project Info */}
      <View style={styles.info}>
        <View style={styles.infoRow}>
          <View style={styles.infoBadges}>
            <Badge
              text={project.status}
              variant={project.status === 'active' ? 'success' : 'default'}
            />
            <Badge
              text={isApiProject ? 'API' : 'Web POM'}
              variant={isApiProject ? 'info' : 'default'}
            />
          </View>
          <Text style={styles.date}>{formatDate(project.created_at)}</Text>
        </View>
        {project.description ? (
          <Text style={styles.desc}>{project.description}</Text>
        ) : null}
        <Text style={styles.url}>{formatUrl(project.base_url)}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isApiProject ? (
          <>
            <Button
              title="Add Endpoint"
              onPress={() => setShowEndpointForm(true)}
            />
            {endpoints.length > 0 && (
              <Button
                title="Download ZIP"
                variant="secondary"
                onPress={() => setShowDownloadModal(true)}
                loading={downloading}
              />
            )}
          </>
        ) : (
          <>
            <Button
              title="Extract URL"
              onPress={() => {
                setExtractUrl(project.base_url);
                setShowExtract(true);
              }}
            />
            {generations.length > 0 && (
              <Button
                title="Download ZIP"
                variant="secondary"
                onPress={() => setShowDownloadModal(true)}
                loading={downloading}
              />
            )}
          </>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {isApiProject ? (
          <>
            <Pressable
              style={[styles.tab, activeTab === 'endpoints' && styles.tabActive]}
              onPress={() => setActiveTab('endpoints')}
            >
              <Ionicons
                name="cloud-outline"
                size={16}
                color={activeTab === 'endpoints' ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabText, activeTab === 'endpoints' && styles.tabTextActive]}>
                {endTotal}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'framework' && styles.tabActive]}
              onPress={() => setActiveTab('framework')}
            >
              <Ionicons
                name="layers-outline"
                size={16}
                color={activeTab === 'framework' ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabText, activeTab === 'framework' && styles.tabTextActive]}>
                Framework
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.tab, activeTab === 'extractions' && styles.tabActive]}
              onPress={() => setActiveTab('extractions')}
            >
              <Ionicons
                name="scan-outline"
                size={16}
                color={activeTab === 'extractions' ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabText, activeTab === 'extractions' && styles.tabTextActive]}>
                {extTotal}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'generations' && styles.tabActive]}
              onPress={() => setActiveTab('generations')}
            >
              <Ionicons
                name="code-slash-outline"
                size={16}
                color={activeTab === 'generations' ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabText, activeTab === 'generations' && styles.tabTextActive]}>
                {genTotal}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'analyses' && styles.tabActive]}
              onPress={() => setActiveTab('analyses')}
            >
              <Ionicons
                name="analytics-outline"
                size={16}
                color={activeTab === 'analyses' ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabText, activeTab === 'analyses' && styles.tabTextActive]}>
                {anaTotal}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'framework' && styles.tabActive]}
              onPress={() => setActiveTab('framework')}
            >
              <Ionicons
                name="layers-outline"
                size={16}
                color={activeTab === 'framework' ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabText, activeTab === 'framework' && styles.tabTextActive]}>
                Framework
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Content */}
      {activeTab === 'framework' ? (
        <ScrollView
          style={styles.frameworkScroll}
          contentContainerStyle={styles.frameworkContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {templatesLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              {/* Language Header */}
              {language && (
                <View style={styles.fwLangHeader}>
                  <LanguageIcon languageName={language.name} size={28} />
                  <View style={styles.fwLangInfo}>
                    <Text style={styles.fwLangName}>
                      {language.display} ({language.framework})
                    </Text>
                    <View style={styles.fwLangMeta}>
                      <Badge text={language.framework} variant="info" />
                      {isApiProject ? (
                        <>
                          <Badge text={language.name === 'java' ? 'REST Assured + TestNG' : 'requests + pytest'} variant="default" />
                          <Badge text="API Testing" variant="success" />
                        </>
                      ) : (
                        <>
                          <Badge text={TEST_RUNNERS[language.name] || 'unknown'} variant="default" />
                          {getBddFrameworkInfo(language.name) && (
                            <Badge text="BDD Ready" variant="success" />
                          )}
                        </>
                      )}
                    </View>
                  </View>
                </View>
              )}
              <Text style={styles.fwPomBadge}>Generated by pom-app</Text>

              {isApiProject ? (
                <>
                  {/* API: Project Structure */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('structure')}>
                      <Ionicons
                        name={expandedSections.structure ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>Project Structure</Text>
                    </Pressable>
                    {expandedSections.structure && (
                      <View style={styles.fwTree}>
                        <Text style={styles.fwTreeText}>
                          {language ? getApiProjectTree(language.name) : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* API: Quick Start */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('quickstart')}>
                      <Ionicons
                        name={expandedSections.quickstart ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>Quick Start</Text>
                      <Badge text="install.sh" variant="default" />
                    </Pressable>
                    {expandedSections.quickstart && language && (
                      <CodeViewer
                        code={getApiInstallScript(language.name, project?.name || 'project')}
                        language="bash"
                      />
                    )}
                  </View>

                  {/* API: Base Client */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('baseclient')}>
                      <Ionicons
                        name={expandedSections.baseclient ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>Base Client</Text>
                      <Badge text="BaseApiClient" variant="info" />
                    </Pressable>
                    {expandedSections.baseclient && language && (
                      <CodeViewer
                        code={getApiBaseClient(language.name, project?.base_url || '')}
                        language={language.name}
                      />
                    )}
                  </View>

                  {/* API: Config (conftest / BaseApiTest) */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('conftest')}>
                      <Ionicons
                        name={expandedSections.conftest ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>
                        {language?.name === 'java' ? 'BaseApiTest' : 'Config'}
                      </Text>
                      <Badge text={language?.name === 'java' ? 'BaseApiTest.java' : 'conftest.py'} variant="default" />
                    </Pressable>
                    {expandedSections.conftest && language && (
                      <CodeViewer
                        code={getApiConftest(language.name)}
                        language={language.name}
                      />
                    )}
                  </View>

                  {/* API: .env.example */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('env')}>
                      <Ionicons
                        name={expandedSections.env ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>.env.example</Text>
                    </Pressable>
                    {expandedSections.env && (
                      <CodeViewer
                        code={getApiEnvExample(project?.base_url || '')}
                        language="text"
                      />
                    )}
                  </View>

                  {/* API: Dockerfile */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('dockerfile')}>
                      <Ionicons
                        name={expandedSections.dockerfile ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>Dockerfile</Text>
                    </Pressable>
                    {expandedSections.dockerfile && language && (
                      <CodeViewer
                        code={getApiDockerfile(language.name)}
                        language="text"
                      />
                    )}
                  </View>

                  {/* API: CI/CD */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('ci')}>
                      <Ionicons
                        name={expandedSections.ci ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>CI/CD</Text>
                      <Badge text="GitHub Actions" variant="default" />
                    </Pressable>
                    {expandedSections.ci && language && (
                      <CodeViewer
                        code={getApiCiWorkflow(language.name, project?.name || 'project')}
                        language="yaml"
                      />
                    )}
                  </View>

                  {/* API: .gitignore */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('gitignore')}>
                      <Ionicons
                        name={expandedSections.gitignore ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>.gitignore</Text>
                    </Pressable>
                    {expandedSections.gitignore && language && (
                      <CodeViewer
                        code={getApiGitignore(language.name)}
                        language="text"
                      />
                    )}
                  </View>

                  {/* API: README.md */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('readme')}>
                      <Ionicons
                        name={expandedSections.readme ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>README.md</Text>
                    </Pressable>
                    {expandedSections.readme && language && (
                      <CodeViewer
                        code={getApiReadme(project?.name || 'project', language.name, endpoints)}
                        language="markdown"
                      />
                    )}
                  </View>
                </>
              ) : (
                <>
                  {/* Web: Project Structure */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('structure')}>
                      <Ionicons
                        name={expandedSections.structure ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>Project Structure</Text>
                    </Pressable>
                    {expandedSections.structure && (
                      <View style={styles.fwTree}>
                        <Text style={styles.fwTreeText}>
                          {language ? getProjectTree(language.name) : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Web: Quick Start */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('quickstart')}>
                      <Ionicons
                        name={expandedSections.quickstart ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>Quick Start</Text>
                      <Badge text="install.sh" variant="default" />
                    </Pressable>
                    {expandedSections.quickstart && language && (
                      <CodeViewer
                        code={getInstallScript(language.name, project?.name || 'project')}
                        language="bash"
                      />
                    )}
                  </View>

                  {/* Web: BDD Framework */}
                  {language && getBddFrameworkInfo(language.name) && (
                    <View style={styles.fwSection}>
                      <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('bdd')}>
                        <Ionicons
                          name={expandedSections.bdd ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.fwSectionTitle}>BDD Framework</Text>
                        <Badge text={getBddFrameworkInfo(language.name)!.name} variant="success" />
                      </Pressable>
                      {expandedSections.bdd && (() => {
                        const bdd = getBddFrameworkInfo(language.name)!;
                        return (
                          <View>
                            {/* BDD overview row */}
                            <View style={styles.bddOverview}>
                              <View style={styles.bddOverviewItem}>
                                <Text style={styles.bddLabel}>Framework</Text>
                                <Text style={styles.bddValue}>{bdd.name}</Text>
                              </View>
                              <View style={styles.bddOverviewItem}>
                                <Text style={styles.bddLabel}>Features</Text>
                                <Text style={styles.bddValue}>{bdd.featureDir}</Text>
                              </View>
                              <View style={styles.bddOverviewItem}>
                                <Text style={styles.bddLabel}>Steps</Text>
                                <Text style={styles.bddValue}>{bdd.stepsDir}</Text>
                              </View>
                            </View>

                            {/* Run command */}
                            <View style={styles.bddRunSection}>
                              <Ionicons name="terminal-outline" size={14} color={colors.success} />
                              <Text style={styles.bddRunLabel}>Run BDD:</Text>
                              <Text style={styles.bddRunCmd}>{bdd.runner}</Text>
                            </View>

                            {/* Config file preview */}
                            <View style={styles.bddFileSection}>
                              <View style={styles.bddFileHeader}>
                                <Ionicons name="settings-outline" size={14} color={colors.textSecondary} />
                                <Text style={styles.bddFileName}>{bdd.configFile}</Text>
                              </View>
                              <CodeViewer
                                code={getBddConfigPreview(language.name)}
                                language={language.name === 'csharp' ? 'json' : language.name === 'java' ? 'xml' : language.name}
                              />
                            </View>

                            {/* Hooks preview */}
                            <View style={styles.bddFileSection}>
                              <View style={styles.bddFileHeader}>
                                <Ionicons name="git-branch-outline" size={14} color={colors.textSecondary} />
                                <Text style={styles.bddFileName}>{bdd.hooksFile}</Text>
                                <Badge text="Hooks" variant="default" />
                              </View>
                              <CodeViewer
                                code={getBddHooksPreview(language.name)}
                                language={language.name}
                              />
                            </View>

                            {/* Steps preview */}
                            <View style={styles.bddFileSection}>
                              <View style={styles.bddFileHeader}>
                                <Ionicons name="footsteps-outline" size={14} color={colors.textSecondary} />
                                <Text style={styles.bddFileName}>{bdd.stepsDir}common_steps</Text>
                                <Badge text="Steps" variant="default" />
                              </View>
                              <CodeViewer
                                code={getBddStepsPreview(language.name)}
                                language={language.name}
                              />
                            </View>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* Web: Scaffold Files */}
                  {scaffoldTemplates.length > 0 && (
                    <View style={styles.fwSection}>
                      <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('scaffold')}>
                        <Ionicons
                          name={expandedSections.scaffold ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.fwSectionTitle}>Scaffold Files</Text>
                        <Badge text={`${scaffoldTemplates.length}`} variant="default" />
                      </Pressable>
                      {expandedSections.scaffold && scaffoldTemplates.map((tpl) => (
                        <View key={tpl.id} style={styles.scaffoldItem}>
                          <View style={styles.scaffoldHeader}>
                            <View style={styles.scaffoldFileInfo}>
                              <Ionicons
                                name={tpl.template_type === 'base_page' ? 'cube-outline' : 'document-text-outline'}
                                size={16}
                                color={tpl.template_type === 'base_page' ? colors.primary : colors.textSecondary}
                              />
                              <Text style={[
                                styles.scaffoldFilename,
                                tpl.template_type === 'base_page' && styles.scaffoldFilenameHighlight,
                              ]}>
                                {tpl.filename_template}
                              </Text>
                              {tpl.template_type === 'base_page' && (
                                <Badge text="BasePage" variant="info" />
                              )}
                            </View>
                            <Text style={styles.scaffoldPath}>{tpl.directory_path}</Text>
                          </View>
                          <CodeViewer
                            code={tpl.content}
                            language={getLangFromFilename(tpl.filename_template)}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Web: .gitignore */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('gitignore')}>
                      <Ionicons
                        name={expandedSections.gitignore ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>.gitignore</Text>
                    </Pressable>
                    {expandedSections.gitignore && language && (
                      <CodeViewer
                        code={getGitignore(language.name)}
                        language="text"
                      />
                    )}
                  </View>

                  {/* Web: README.md */}
                  <View style={styles.fwSection}>
                    <Pressable style={styles.fwSectionHeader} onPress={() => toggleSection('readme')}>
                      <Ionicons
                        name={expandedSections.readme ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.fwSectionTitle}>README.md</Text>
                    </Pressable>
                    {expandedSections.readme && language && (
                      <CodeViewer
                        code={getReadme(project?.name || 'project', language.name, language.framework)}
                        language="markdown"
                      />
                    )}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={tabData as any[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={Math.min(index, 10)}>
              {activeTab === 'endpoints' ? (
                <EndpointItem
                  endpoint={item}
                  onPress={() => router.push(`/endpoint/${item.id}?projectId=${id}`)}
                  onDelete={() => handleDeleteEndpoint(item.id)}
                />
              ) : activeTab === 'extractions' && item._type === 'folder' ? (
                <FolderCard
                  folder={item}
                  onPress={() => setCurrentFolder(item.folder)}
                  onRename={(newName) => handleRenameFolder(item.folder, newName)}
                  onDelete={() => handleDeleteFolder(item.folder)}
                  onDropExtraction={(extractionId) => handleDropToFolder(extractionId, item.folder)}
                />
              ) : activeTab === 'extractions' ? (
                <ExtractionItem
                  extraction={item}
                  draggable
                  onPress={() => router.push(`/extraction/${item.id}?projectId=${id}`)}
                  onRename={async (newTitle) => {
                    try {
                      await store.updateExtractionTitle(id!, item.id, newTitle);
                      setExtractions((prev) =>
                        prev.map((e) => e.id === item.id ? { ...e, page_title: newTitle } : e)
                      );
                      toast('success', 'Title updated');
                    } catch (err: any) {
                      toast('error', err?.response?.data?.error || 'Failed to rename');
                    }
                  }}
                  onMoveToFolder={() => handleMoveToFolder(item.id)}
                />
              ) : activeTab === 'generations' && item._type === 'folder' ? (
                <FolderCard
                  folder={item}
                  onPress={() => setCurrentFolder(item.folder)}
                  onRename={(newName) => handleRenameFolder(item.folder, newName)}
                  onDelete={() => handleDeleteFolder(item.folder)}
                  onDropGeneration={(generationId) => handleDropGenerationToFolder(generationId, item.folder)}
                />
              ) : activeTab === 'generations' ? (
                <GenerationItem
                  generation={item}
                  draggable
                  onPress={() => router.push(`/generation/${item.id}?projectId=${id}`)}
                  onMoveToFolder={() => handleMoveGenerationToFolder(item.id)}
                />
              ) : (
                <AnalysisItem
                  analysis={item}
                  onPress={() => router.push(`/analysis/${item.id}?projectId=${id}`)}
                  onDelete={() => handleDeleteAnalysis(item.id)}
                />
              )}
            </AnimatedListItem>
          )}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            activeTab === 'analyses' ? (
              <View style={styles.aiAnalyzeHeader}>
                <View style={styles.aiAnalyzeCard}>
                  <View style={styles.aiAnalyzeTitle}>
                    <Ionicons name="sparkles-outline" size={16} color={colors.warning} />
                    <Text style={styles.aiAnalyzeTitleText}>AI Analysis</Text>
                  </View>
                  <Text style={styles.aiAnalyzeDesc}>
                    Run Ollama locally to analyze your generated code and suggest improvements.
                  </Text>

                  <View style={styles.aiToggleRow}>
                    <View style={styles.aiToggleInfo}>
                      <Text style={styles.aiToggleLabel}>Comment code</Text>
                      <Text style={styles.aiToggleHint}>Suggest descriptive comments for page objects and methods</Text>
                    </View>
                    <Switch
                      value={aiCommentCode}
                      onValueChange={setAiCommentCode}
                      trackColor={{ false: colors.bgTertiary, true: colors.primaryDark }}
                      thumbColor={aiCommentCode ? colors.primary : colors.borderLight}
                      disabled={aiAnalyzing}
                    />
                  </View>

                  <View style={styles.aiSeparator} />

                  <View style={styles.aiToggleRow}>
                    <View style={styles.aiToggleInfo}>
                      <Text style={styles.aiToggleLabel}>Improve tests</Text>
                      <Text style={styles.aiToggleHint}>Suggest better assertions, edge cases, and coverage improvements</Text>
                    </View>
                    <Switch
                      value={aiImproveTests}
                      onValueChange={setAiImproveTests}
                      trackColor={{ false: colors.bgTertiary, true: colors.primaryDark }}
                      thumbColor={aiImproveTests ? colors.primary : colors.borderLight}
                      disabled={aiAnalyzing}
                    />
                  </View>

                  <View style={styles.aiSeparator} />

                  {/* Page selection */}
                  <Pressable
                    style={styles.aiPageSelectorToggle}
                    onPress={async () => {
                      const willExpand = !aiPagesExpanded;
                      setAiPagesExpanded(willExpand);
                      if (willExpand && aiAllGenerations.length === 0 && id) {
                        try {
                          const res = await store.fetchGenerations(id, { limit: 200, offset: 0, folder: '__all__' });
                          setAiAllGenerations(res.data);
                        } catch {}
                      }
                    }}
                    disabled={aiAnalyzing}
                  >
                    <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.aiPageSelectorLabel}>
                      {aiSelectedPages.size === 0
                        ? 'All pages'
                        : `${aiSelectedPages.size} of ${aiAllGenerations.length} pages selected`}
                    </Text>
                    <Ionicons name={aiPagesExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
                  </Pressable>

                  {aiPagesExpanded && !aiAnalyzing && (
                    <ScrollView style={styles.aiPageList} nestedScrollEnabled>
                      <Pressable
                        style={styles.aiPageSelectAll}
                        onPress={() => {
                          if (aiSelectedPages.size === aiAllGenerations.length) {
                            setAiSelectedPages(new Set());
                          } else {
                            setAiSelectedPages(new Set(aiAllGenerations.map(g => g.id)));
                          }
                        }}
                      >
                        <Text style={styles.aiPageSelectAllText}>
                          {aiSelectedPages.size === aiAllGenerations.length ? 'Deselect all' : 'Select all'}
                        </Text>
                      </Pressable>
                      {aiAllGenerations.map(gen => {
                        const selected = aiSelectedPages.has(gen.id);
                        return (
                          <Pressable
                            key={gen.id}
                            style={styles.aiPageItem}
                            onPress={() => {
                              const next = new Set(aiSelectedPages);
                              if (selected) next.delete(gen.id);
                              else next.add(gen.id);
                              setAiSelectedPages(next);
                            }}
                          >
                            <Ionicons
                              name={selected ? 'checkbox' : 'square-outline'}
                              size={18}
                              color={selected ? colors.primary : colors.textTertiary}
                            />
                            <Text style={[styles.aiPageItemText, selected && styles.aiPageItemTextSelected]}>
                              {gen.page_name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  {aiAnalyzing && aiJobStatus ? (
                    <View style={styles.aiProgressBanner}>
                      <View style={styles.aiProgressHeader}>
                        <ActivityIndicator size="small" color={colors.warning} />
                        <Text style={styles.aiProgressTitle}>
                          {aiJobStatus.status === 'applying' ? 'Applying improvements' : 'Analyzing'}
                        </Text>
                        <Text style={styles.aiElapsedText}>{formatElapsed(aiElapsed)}</Text>
                      </View>
                      <Text style={styles.aiProgressDetail}>
                        Page {aiJobStatus.current_page} of {aiJobStatus.total_pages}
                        {aiJobStatus.page_name ? ` — ${aiJobStatus.page_name}` : ''}
                      </Text>
                      {aiJobStatus.current_task ? (
                        <Text style={styles.aiTaskDetail}>
                          {taskLabel(aiJobStatus.current_task)}
                        </Text>
                      ) : null}
                      <View style={styles.aiProgressBar}>
                        <View style={[styles.aiProgressFill, {
                          width: `${Math.round((aiJobStatus.current_page / aiJobStatus.total_pages) * 100)}%`
                        }]} />
                      </View>
                      <Pressable
                        style={styles.aiCancelBtn}
                        onPress={handleCancelAnalysis}
                      >
                        <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                        <Text style={styles.aiCancelBtnText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.aiAnalyzeBtn, (!aiCommentCode && !aiImproveTests) && styles.aiAnalyzeBtnDisabled]}
                      onPress={handleAiAnalyze}
                      disabled={!aiCommentCode && !aiImproveTests}
                    >
                      <View style={styles.aiAnalyzeBtnContent}>
                        <Ionicons name="sparkles" size={14} color={colors.text} />
                        <Text style={styles.aiAnalyzeBtnText}>
                          {aiSelectedPages.size > 0
                            ? `Analyze ${aiSelectedPages.size} page${aiSelectedPages.size !== 1 ? 's' : ''} with AI`
                            : 'Analyze all pages with AI'}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : (activeTab === 'extractions' || activeTab === 'generations') ? (
              <View style={styles.folderHeader}>
                {currentFolder !== null && (
                  <Pressable style={styles.breadcrumb} onPress={() => setCurrentFolder(null)}>
                    <Ionicons name="arrow-back" size={16} color={colors.primary} />
                    <Text style={styles.breadcrumbText}>{activeTab === 'extractions' ? 'All Pages' : 'All Generations'}</Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                    <Ionicons name="folder-outline" size={14} color={colors.warning} />
                    <Text style={styles.breadcrumbFolder}>{currentFolder}</Text>
                  </Pressable>
                )}
                {currentFolder !== null && Platform.OS === 'web' && activeTab === 'extractions' && (
                  <RootDropZone onDrop={(extractionId) => handleDropToFolder(extractionId, null)} dataKey="extractionId" />
                )}
                {currentFolder !== null && Platform.OS === 'web' && activeTab === 'generations' && (
                  <RootDropZone onDrop={(generationId) => handleDropGenerationToFolder(generationId, null)} dataKey="generationId" />
                )}
                <Pressable style={styles.newFolderBtn} onPress={() => setShowNewFolder(true)}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.newFolderText}>New Folder</Text>
                </Pressable>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={hasMore ? handleLoadMore : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                activeTab === 'endpoints'
                  ? 'cloud-outline'
                  : activeTab === 'extractions'
                  ? 'scan-outline'
                  : activeTab === 'generations'
                  ? 'code-slash-outline'
                  : 'analytics-outline'
              }
              title={
                activeTab === 'endpoints'
                  ? 'No endpoints yet'
                  : activeTab === 'extractions'
                  ? 'No extractions yet'
                  : activeTab === 'generations'
                  ? 'No generations yet'
                  : 'No analyses yet'
              }
              subtitle={
                activeTab === 'endpoints'
                  ? 'Add API endpoints to generate test code'
                  : activeTab === 'extractions'
                  ? 'Extract a URL to get page elements'
                  : activeTab === 'generations'
                  ? 'Generate POM code from an extraction'
                  : 'Analyze extractions with AI (premium)'
              }
              actionLabel={
                activeTab === 'endpoints' ? 'Add Endpoint'
                : activeTab === 'extractions' ? 'Extract URL'
                : undefined
              }
              onAction={
                activeTab === 'endpoints' ? () => setShowEndpointForm(true)
                : activeTab === 'extractions' ? () => setShowExtract(true)
                : undefined
              }
            />
          }
        />
      )}

      {/* Add Endpoint Modal */}
      <EndpointForm
        visible={showEndpointForm}
        onClose={() => setShowEndpointForm(false)}
        onSubmit={handleCreateEndpoint}
      />

      {/* Extract Modal */}
      <Modal visible={showExtract} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modal}>
            {extractStatus === 'form' ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Extract Elements</Text>
                  <Pressable onPress={() => setShowExtract(false)}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </Pressable>
                </View>
                {/* Mode toggle */}
                <View style={styles.extractModeToggle}>
                  <Pressable
                    style={[styles.extractModeTab, extractMode === 'url' && styles.extractModeTabActive]}
                    onPress={() => { setExtractMode('url'); setExtractError(''); }}
                  >
                    <Ionicons name="globe-outline" size={16} color={extractMode === 'url' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.extractModeTabText, extractMode === 'url' && styles.extractModeTabTextActive]}>From URL</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.extractModeTab, extractMode === 'html' && styles.extractModeTabActive]}
                    onPress={() => { setExtractMode('html'); setExtractError(''); }}
                  >
                    <Ionicons name="code-outline" size={16} color={extractMode === 'html' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.extractModeTabText, extractMode === 'html' && styles.extractModeTabTextActive]}>Paste HTML</Text>
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {extractMode === 'url' ? (
                    <>
                      <Text style={styles.modalSubtitle}>
                        Extract interactive elements from a web page using Playwright
                      </Text>
                      <Input
                        label="URL"
                        value={extractUrl}
                        onChangeText={setExtractUrl}
                        placeholder="https://example.com/dashboard"
                        keyboardType="url"
                        autoCapitalize="none"
                      />
                      <PreStepsConfig
                        projectId={id!}
                        extractions={extractions}
                        onStepsChange={(steps) => { authStepsRef.current = steps; }}
                        initialSteps={authStepsRef.current.length > 0 ? authStepsRef.current : undefined}
                      />
                      <CookieInjector
                        targetUrl={extractUrl || project?.base_url || ''}
                        onCookiesChange={(cookies) => { cookiesRef.current = cookies; }}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.modalSubtitle}>
                        Paste the full page HTML below.
                      </Text>
                      <Pressable
                        style={styles.htmlTipHeader}
                        onPress={() => setShowHtmlTip(!showHtmlTip)}
                      >
                        <Ionicons name="bulb-outline" size={16} color={colors.warning} />
                        <Text style={styles.htmlTipHeaderText}>How to extract HTML</Text>
                        <Ionicons
                          name={showHtmlTip ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                      {showHtmlTip && (
                        <View style={styles.htmlTipBody}>
                          <Text style={styles.htmlTipStep}>1. Open the target page in your browser</Text>
                          <Text style={styles.htmlTipStep}>2. Press F12 or Ctrl+Shift+I to open DevTools</Text>
                          <Text style={styles.htmlTipStep}>3. Go to the Console tab</Text>
                          <Text style={styles.htmlTipStep}>4. Run:</Text>
                          <View style={styles.htmlTipCodeRow}>
                            <View style={styles.htmlTipCodeBlock}>
                              <Text style={styles.htmlTipCode}>copy(document.documentElement.outerHTML)</Text>
                            </View>
                            <Pressable
                              style={styles.copyBtn}
                              onPress={async () => {
                                try {
                                  await Clipboard.setStringAsync('copy(document.documentElement.outerHTML)');
                                  toast('success', 'Command copied');
                                } catch { toast('error', 'Failed to copy'); }
                              }}
                              hitSlop={6}
                            >
                              <Ionicons name="copy-outline" size={16} color={colors.primary} />
                            </Pressable>
                          </View>
                          <Text style={styles.htmlTipStep}>5. Paste here (Ctrl+V)</Text>
                        </View>
                      )}
                      <Input
                        label="URL (optional)"
                        value={extractUrl}
                        onChangeText={setExtractUrl}
                        placeholder="https://example.com/dashboard"
                        keyboardType="url"
                        autoCapitalize="none"
                      />
                      <Text style={[styles.htmlLabel]}>HTML Content</Text>
                      <TextInput
                        style={styles.htmlTextarea}
                        value={htmlInput}
                        onChangeText={setHtmlInput}
                        placeholder="<html>...</html>"
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        textAlignVertical="top"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  )}
                  {extractError ? <Text style={styles.error}>{extractError}</Text> : null}
                </ScrollView>
                <View style={styles.modalActions}>
                  <Button title="Cancel" variant="secondary" onPress={() => setShowExtract(false)} />
                  <Button
                    title="Extract"
                    onPress={extractMode === 'url' ? handleExtract : handleExtractHtml}
                    loading={extracting}
                  />
                </View>
              </>
            ) : (
              <ExtractionProgressView
                url={extractUrl || project?.base_url || ''}
                status={extractStatus as 'extracting' | 'queued' | 'success' | 'error'}
                elapsedSeconds={extractElapsed}
                errorMessage={extractError}
                errorCode={extractErrorCode}
                preSteps={authStepsRef.current.length > 0 ? authStepsRef.current : undefined}
                onCancel={handleExtractCancel}
                onRetry={handleExtractRetry}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Download ZIP Modal */}
      <DownloadZipModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        downloading={downloading}
        onDownload={handleDownloadZip}
      />

      {/* New Folder Modal */}
      <Modal visible={showNewFolder} transparent animationType="fade" onRequestClose={() => setShowNewFolder(false)}>
        <Pressable style={styles.folderOverlay} onPress={() => setShowNewFolder(false)}>
          <View style={styles.folderModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.folderModalTitle}>New Folder</Text>
            <TextInput
              style={styles.folderModalInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="folder-name (lowercase)"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              onSubmitEditing={handleCreateFolder}
              returnKeyType="done"
            />
            <View style={styles.folderModalActions}>
              <Pressable style={styles.folderModalCancel} onPress={() => { setShowNewFolder(false); setNewFolderName(''); }}>
                <Text style={styles.folderModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.folderModalConfirm} onPress={handleCreateFolder}>
                <Text style={styles.folderModalConfirmText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Move to Folder Picker Modal */}
      <Modal visible={showFolderPicker} transparent animationType="fade" onRequestClose={() => setShowFolderPicker(false)}>
        <Pressable style={styles.folderOverlay} onPress={() => setShowFolderPicker(false)}>
          <View style={styles.folderModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.folderModalTitle}>Move to Folder</Text>
            <ScrollView style={styles.folderPickerList}>
              <Pressable style={styles.folderPickerItem} onPress={() => handleConfirmMoveToFolder(null)}>
                <Ionicons name="home-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.folderPickerText}>Root (no folder)</Text>
              </Pressable>
              {folders.map((f) => (
                <Pressable key={f.folder} style={styles.folderPickerItem} onPress={() => handleConfirmMoveToFolder(f.folder)}>
                  <Ionicons name="folder-outline" size={18} color={colors.warning} />
                  <Text style={styles.folderPickerText}>{f.folder}</Text>
                  <Text style={styles.folderPickerCount}>{f.extraction_count}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.folderModalCancel} onPress={() => setShowFolderPicker(false)}>
              <Text style={styles.folderModalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  infoBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  desc: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs,
  },
  url: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  date: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingMore: {
    paddingVertical: spacing.md,
    alignItems: 'center',
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
  modalScroll: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.lg,
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
  extractModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  extractModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md - 2,
  },
  extractModeTabActive: {
    backgroundColor: colors.bgSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  extractModeTabText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  extractModeTabTextActive: {
    color: colors.primary,
  },
  htmlLabel: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  htmlTextarea: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    color: colors.text,
    minHeight: 200,
    maxHeight: 400,
  },
  htmlTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  htmlTipHeaderText: {
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    flex: 1,
  },
  htmlTipBody: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: 4,
  },
  htmlTipStep: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  htmlTipCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: 4,
  },
  htmlTipCodeBlock: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  copyBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSecondary,
  },
  htmlTipCode: {
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    color: colors.primary,
  },
  frameworkScroll: {
    flex: 1,
  },
  frameworkContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fwLangHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  fwLangInfo: {
    flex: 1,
  },
  fwLangName: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  fwLangMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  fwPomBadge: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginBottom: spacing.md,
  },
  fwSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  fwSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  fwSectionTitle: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
    flex: 1,
  },
  fwTree: {
    padding: spacing.sm,
    backgroundColor: colors.bg,
  },
  fwTreeText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    fontFamily: fonts.mono,
    lineHeight: 18,
  },
  bddOverview: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bddOverviewItem: {
    flex: 1,
  },
  bddLabel: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginBottom: 2,
  },
  bddValue: {
    color: colors.text,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
    fontFamily: fonts.mono,
  },
  bddRunSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgTertiary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bddRunLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
  },
  bddRunCmd: {
    color: colors.success,
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.mono,
    fontWeight: '500',
  },
  bddFileSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bddFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  bddFileName: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.mono,
    flex: 1,
  },
  scaffoldItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scaffoldHeader: {
    padding: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  scaffoldFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  scaffoldFilename: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.mono,
  },
  scaffoldFilenameHighlight: {
    color: colors.primary,
  },
  scaffoldPath: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    marginLeft: spacing.md + spacing.xs,
  },
  // Folder styles
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breadcrumbText: {
    color: colors.primary,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  breadcrumbFolder: {
    color: colors.warning,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  newFolderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newFolderText: {
    color: colors.primary,
    fontSize: fonts.sizes.xs,
    fontWeight: '500',
  },
  folderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  folderModal: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  folderModalTitle: {
    color: colors.text,
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  folderModalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: fonts.sizes.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  folderModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  folderModalCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  folderModalCancelText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
  },
  folderModalConfirm: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  folderModalConfirmText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
  folderPickerList: {
    maxHeight: 300,
    marginBottom: spacing.md,
  },
  folderPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  folderPickerText: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    flex: 1,
  },
  folderPickerCount: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
  },
  aiAnalyzeHeader: {
    paddingBottom: spacing.md,
  },
  aiAnalyzeCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  aiAnalyzeTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  aiAnalyzeTitleText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    fontWeight: '500',
    color: colors.warning,
  },
  aiAnalyzeDesc: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  aiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiToggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  aiToggleLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '500',
    color: colors.text,
  },
  aiToggleHint: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  aiSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  aiPageSelectorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  aiPageSelectorLabel: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  aiPageList: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginBottom: spacing.xs,
    maxHeight: 200,
  },
  aiPageSelectAll: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginBottom: 2,
  },
  aiPageSelectAllText: {
    fontSize: fonts.sizes.xs,
    fontFamily: fonts.regular,
    color: colors.primary,
    fontWeight: '600',
  },
  aiPageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  aiPageItemText: {
    fontSize: fonts.sizes.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    flex: 1,
  },
  aiPageItemTextSelected: {
    color: colors.text,
  },
  aiAnalyzeBtn: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(210, 153, 34, 0.2)',
    borderWidth: 1,
    borderColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  aiAnalyzeBtnDisabled: {
    opacity: 0.4,
  },
  aiAnalyzeBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiAnalyzeBtnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  aiProgressBanner: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(210, 153, 34, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(210, 153, 34, 0.3)',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  aiProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiProgressTitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    fontWeight: '600',
    color: colors.warning,
    flex: 1,
  },
  aiElapsedText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  aiProgressDetail: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 24,
  },
  aiTaskDetail: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 2,
    marginLeft: 24,
    fontStyle: 'italic',
  },
  aiProgressBar: {
    height: 4,
    backgroundColor: colors.bgTertiary,
    borderRadius: 2,
    marginTop: spacing.xs,
    marginLeft: 24,
    overflow: 'hidden',
  },
  aiProgressFill: {
    height: '100%',
    backgroundColor: colors.warning,
    borderRadius: 2,
  },
  aiCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  aiCancelBtnText: {
    color: colors.danger,
    fontSize: fonts.sizes.xs,
    fontWeight: '500',
  },
});
