/**
 * Generation Screen — Apply Polling Tests
 *
 * Task 1: Bug Condition Exploration — FAILS on unfixed code (proves bug exists)
 * Task 2: Preservation Properties   — PASSES on unfixed code (confirms baseline)
 *
 * After fix (Tasks 3.1–3.6):
 *   Task 1 tests PASS  → bug is fixed
 *   Task 2 tests still PASS → no regressions
 *
 * Bug: GenerationDetailScreen opens while apply is in progress → shows stale code,
 *      no polling, no visual indicator, no auto-refresh when apply completes.
 *
 * Fix: Add getJobProgress to store + polling infrastructure in component.
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  setOnUnauthorized: jest.fn(),
}));

jest.mock('../api/generations', () => ({
  listGenerations: jest.fn(async () => ({ data: [], total: 0 })),
  getGeneration: jest.fn(async (projectId: string, generationId: string) => ({
    id: generationId,
    project_id: projectId,
    page_name: 'LoginPage',
    page_code: 'class LoginPage:\n    pass',
    test_code: 'def test_login(): pass',
    status: 'completed',
    language_id: 'python',
    llm_model: 'gpt-4',
    tokens_used: 1500,
    created_at: '2026-01-01T00:00:00Z',
  })),
  patchGeneration: jest.fn(async () => {}),
  updateGenerationFolder: jest.fn(async () => {}),
  deleteGeneration: jest.fn(async () => {}),
}));

jest.mock('../api/projects', () => ({
  listProjects: jest.fn(async () => []),
  createProject: jest.fn(async () => ({ id: 'p1', name: 'Test' })),
  deleteProject: jest.fn(async () => {}),
  getProject: jest.fn(async (id: string) => ({
    id,
    name: 'Test Project',
    base_url: 'http://test.com',
    project_type: 'web',
    created_at: '2026-01-01T00:00:00Z',
  })),
  updateProject: jest.fn(async () => {}),
}));

jest.mock('../api/extractions', () => ({
  listExtractions: jest.fn(async () => ({ data: [], total: 0 })),
  getExtraction: jest.fn(async () => ({ id: 'e1' })),
  patchExtraction: jest.fn(async () => {}),
  deleteExtraction: jest.fn(async () => {}),
  deleteElements: jest.fn(async () => ({ element_count: 0 })),
  createFolder: jest.fn(async () => {}),
  listFolders: jest.fn(async () => []),
  updateExtractionFolder: jest.fn(async () => {}),
  renameFolder: jest.fn(async () => {}),
  deleteFolder: jest.fn(async () => {}),
  saveManualExtraction: jest.fn(async () => ({ id: 'e1' })),
}));

jest.mock('../api/extract', () => ({
  extractUrl: jest.fn(async () => ({ extraction_id: 'e1' })),
}));

jest.mock('../api/generate', () => ({
  generatePom: jest.fn(async () => ({ generation_id: 'g1' })),
}));

jest.mock('../api/analyses', () => ({
  listAnalyses: jest.fn(async () => ({ data: [], total: 0 })),
  getAnalysis: jest.fn(async () => ({ id: 'a1' })),
  deleteAnalysis: jest.fn(async () => {}),
}));

jest.mock('../api/analyze', () => ({
  analyze: jest.fn(async () => ({ analysis_id: 'a1' })),
}));

jest.mock('../api/api-endpoints', () => ({
  listApiEndpoints: jest.fn(async () => ({ data: [], total: 0 })),
  getApiEndpoint: jest.fn(async () => ({ id: 'ep1' })),
  createApiEndpoint: jest.fn(async () => ({ id: 'ep1' })),
  updateApiEndpoint: jest.fn(async () => {}),
  deleteApiEndpoint: jest.fn(async () => {}),
}));

jest.mock('../utils/storage', () => ({
  getToken: jest.fn(async () => 'mock-token'),
  setToken: jest.fn(async () => {}),
  removeToken: jest.fn(async () => {}),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { useProjectsStore } from '../stores/projects';
import * as generationsApi from '../api/generations';
import { api } from '../api/client';

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_GENERATION = {
  id: 'gen-1',
  project_id: 'proj-1',
  page_name: 'LoginPage',
  page_code: 'class LoginPage:\n    def __init__(self):\n        pass',
  test_code: 'def test_login_page():\n    pass',
  status: 'completed',
  language_id: 'python',
  llm_model: 'gpt-4',
  tokens_used: 1500,
  created_at: '2026-01-01T00:00:00Z',
};

const MOCK_UPDATED_GENERATION = {
  ...MOCK_GENERATION,
  page_code: 'class LoginPage:\n    # Updated after apply\n    def login(self, user, pwd): pass',
  test_code: 'def test_login_page():\n    # Updated test\n    assert True',
};

const MOCK_APPLY_STATUS = {
  status: 'applying',
  started_at: Math.floor(Date.now() / 1000) - 10,
  current_page: 2,
  total_pages: 5,
  page_name: 'LoginPage',
  current_task: 'saving',
};

const MOCK_IDLE_STATUS = {
  status: 'idle',
  started_at: 0,
  current_page: 0,
  total_pages: 0,
  page_name: '',
  current_task: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetStore() {
  useProjectsStore.setState({ projects: [], isLoading: false });
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
  (generationsApi.getGeneration as jest.Mock).mockResolvedValue(MOCK_GENERATION);
  (generationsApi.patchGeneration as jest.Mock).mockResolvedValue(undefined);
  (generationsApi.deleteGeneration as jest.Mock).mockResolvedValue(undefined);
});

// =============================================================================
// TASK 1 — BUG CONDITION EXPLORATION
// Property 1: Apply Progress Detection and Auto-Refresh
//
// EXPECTED on UNFIXED code: FAIL  (proves the bug exists)
// EXPECTED on FIXED code:   PASS  (confirms the bug is fixed)
// =============================================================================

describe('Task 1 — Bug Condition: Apply Progress Detection and Auto-Refresh', () => {
  it('store has getJobProgress method for apply status polling [interface check]', () => {
    // UNFIXED: getJobProgress is not in store → typeof === 'undefined' → FAIL
    // FIXED:   getJobProgress is added → typeof === 'function' → PASS
    const state = useProjectsStore.getState();
    expect(typeof (state as any).getJobProgress).toBe('function');
  });

  it('getJobProgress returns an object with a status field', async () => {
    // UNFIXED: method does not exist → TypeError: not a function → FAIL
    // FIXED:   calls API and returns { status, started_at, ... } → PASS
    const state = useProjectsStore.getState();
    const getJobProgress = (state as any).getJobProgress as
      | ((projectId: string) => Promise<any>)
      | undefined;
    if (!getJobProgress) {
      throw new Error(
        'getJobProgress is missing from store — apply progress detection is impossible (BUG CONFIRMED)'
      );
    }
    (api.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_APPLY_STATUS });
    const result = await getJobProgress('proj-1');
    expect(result).toHaveProperty('status');
  });

  it('getJobProgress returns status="applying" when apply is in progress', async () => {
    // UNFIXED: method does not exist → FAIL
    // FIXED:   returns { status: 'applying', ... } → PASS
    const state = useProjectsStore.getState();
    const getJobProgress = (state as any).getJobProgress as
      | ((projectId: string) => Promise<any>)
      | undefined;
    if (!getJobProgress) {
      throw new Error('getJobProgress missing — cannot detect apply in progress (BUG CONFIRMED)');
    }
    (api.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_APPLY_STATUS });
    const jobStatus = await getJobProgress('proj-1');
    expect(jobStatus.status).toBe('applying');
  });

  it('getJobProgress calls the correct job-progress API endpoint', async () => {
    // UNFIXED: method does not exist → FAIL
    // FIXED:   calls api.get('/projects/proj-1/ai-analyze/status') → PASS
    const state = useProjectsStore.getState();
    const getJobProgress = (state as any).getJobProgress as
      | ((projectId: string) => Promise<any>)
      | undefined;
    if (!getJobProgress) {
      throw new Error('getJobProgress missing (BUG CONFIRMED)');
    }
    (api.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_IDLE_STATUS });
    await getJobProgress('proj-1');
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('proj-1')
    );
  });

  it('getJobProgress can be called multiple times to simulate polling behavior', async () => {
    // UNFIXED: method does not exist → FAIL
    // FIXED:   method exists and each call returns fresh status → PASS
    // This validates that polling (repeated calls) is possible.
    const state = useProjectsStore.getState();
    const getJobProgress = (state as any).getJobProgress as
      | ((projectId: string) => Promise<any>)
      | undefined;
    if (!getJobProgress) {
      throw new Error('getJobProgress missing — repeated polling not possible (BUG CONFIRMED)');
    }
    (api.get as jest.Mock)
      .mockResolvedValueOnce({ data: MOCK_APPLY_STATUS })
      .mockResolvedValueOnce({ data: MOCK_APPLY_STATUS })
      .mockResolvedValueOnce({ data: MOCK_IDLE_STATUS });

    const call1 = await getJobProgress('proj-1');
    const call2 = await getJobProgress('proj-1');
    const call3 = await getJobProgress('proj-1');

    expect(call1.status).toBe('applying');
    expect(call2.status).toBe('applying');
    expect(call3.status).toBe('idle'); // apply completed
    expect(api.get).toHaveBeenCalledTimes(3);
  });

  it('getJobProgress detects applying→idle transition (auto-refresh trigger)', async () => {
    // UNFIXED: method does not exist → FAIL
    // FIXED:   transition detected → component can trigger auto-refresh → PASS
    // This is the core of the auto-refresh mechanism:
    //   poll until status changes from 'applying' to 'idle', then fetch updated generation.
    const state = useProjectsStore.getState();
    const getJobProgress = (state as any).getJobProgress as
      | ((projectId: string) => Promise<any>)
      | undefined;
    if (!getJobProgress) {
      throw new Error(
        'getJobProgress missing — auto-refresh on apply completion not possible (BUG CONFIRMED)'
      );
    }
    (api.get as jest.Mock)
      .mockResolvedValueOnce({ data: MOCK_APPLY_STATUS })
      .mockResolvedValueOnce({ data: MOCK_IDLE_STATUS });

    const s1 = await getJobProgress('proj-1');
    const s2 = await getJobProgress('proj-1');

    // This transition is what triggers auto-refresh in the component:
    const applyJustCompleted = s1.status === 'applying' && s2.status === 'idle';
    expect(applyJustCompleted).toBe(true);
  });

  it('getJobProgress returns idle status when no apply is in progress', async () => {
    // UNFIXED: method does not exist → FAIL
    // FIXED:   returns { status: 'idle' } when no apply → PASS
    // Validates that the method correctly returns idle when nothing is running.
    const state = useProjectsStore.getState();
    const getJobProgress = (state as any).getJobProgress as
      | ((projectId: string) => Promise<any>)
      | undefined;
    if (!getJobProgress) {
      throw new Error('getJobProgress missing (BUG CONFIRMED)');
    }
    (api.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_IDLE_STATUS });
    const jobStatus = await getJobProgress('proj-1');
    expect(jobStatus.status).toBe('idle');
  });

  it('getGeneration can be called after apply completes to get updated code', async () => {
    // UNFIXED: getJobProgress does not exist, so the "apply complete → refetch" flow
    //          cannot be triggered → code stays stale → FAIL (combined with above)
    // FIXED:   after polling detects idle, getGeneration is called → updated code → PASS
    const state = useProjectsStore.getState();
    const getJobProgress = (state as any).getJobProgress as
      | ((projectId: string) => Promise<any>)
      | undefined;
    if (!getJobProgress) {
      throw new Error(
        'getJobProgress missing — cannot trigger auto-refresh after apply (BUG CONFIRMED)'
      );
    }

    // Simulate: poll → applying → idle → fetch updated generation
    (api.get as jest.Mock)
      .mockResolvedValueOnce({ data: MOCK_APPLY_STATUS })
      .mockResolvedValueOnce({ data: MOCK_IDLE_STATUS });
    (generationsApi.getGeneration as jest.Mock).mockResolvedValueOnce(MOCK_UPDATED_GENERATION);

    const s1 = await getJobProgress('proj-1');
    expect(s1.status).toBe('applying');

    const s2 = await getJobProgress('proj-1');
    expect(s2.status).toBe('idle');

    // Apply completed → fetch updated code
    const updatedGen = await state.getGeneration('proj-1', 'gen-1');
    expect(updatedGen.page_code).toContain('Updated after apply');
    expect(generationsApi.getGeneration).toHaveBeenCalledWith('proj-1', 'gen-1');
  });
});

// =============================================================================
// TASK 2 — PRESERVATION PROPERTY TESTS
// Property 2: Single Fetch Behavior — when NO apply is in progress
//
// EXPECTED on UNFIXED code: PASS  (establishes baseline behavior to preserve)
// EXPECTED on FIXED code:   PASS  (confirms no regressions)
// =============================================================================

describe('Task 2 — Preservation: Single Fetch Behavior When No Apply In Progress', () => {
  describe('Store interface integrity', () => {
    it('store has all required generation methods', () => {
      const state = useProjectsStore.getState();
      expect(typeof state.getGeneration).toBe('function');
      expect(typeof state.getProject).toBe('function');
      expect(typeof state.updateGenerationPageName).toBe('function');
      expect(typeof state.deleteGeneration).toBe('function');
      expect(typeof state.fetchGenerations).toBe('function');
    });

    it('getGeneration returns generation with expected shape', async () => {
      const { getGeneration } = useProjectsStore.getState();
      const gen = await getGeneration('proj-1', 'gen-1');

      expect(gen).toHaveProperty('id');
      expect(gen).toHaveProperty('page_name');
      expect(gen).toHaveProperty('page_code');
      expect(gen).toHaveProperty('test_code');
      expect(gen).toHaveProperty('status');
      expect(gen).toHaveProperty('language_id');
      expect(gen).toHaveProperty('llm_model');
      expect(gen).toHaveProperty('tokens_used');
      expect(gen).toHaveProperty('created_at');
    });

    it('getGeneration is called exactly once (single fetch behavior)', async () => {
      const { getGeneration } = useProjectsStore.getState();
      await getGeneration('proj-1', 'gen-1');

      expect(generationsApi.getGeneration).toHaveBeenCalledTimes(1);
      expect(generationsApi.getGeneration).toHaveBeenCalledWith('proj-1', 'gen-1');
    });

    it('getGeneration returns string page_code and test_code', async () => {
      const { getGeneration } = useProjectsStore.getState();
      const gen = await getGeneration('proj-1', 'gen-1');

      expect(typeof gen.page_code).toBe('string');
      expect(typeof gen.test_code).toBe('string');
      expect(gen.page_code.length).toBeGreaterThan(0);
      expect(gen.test_code.length).toBeGreaterThan(0);
    });

    it('getGeneration does NOT call job-status endpoint when no apply in progress', async () => {
      // Single fetch: only calls getGeneration, NOT the job-progress endpoint
      const { getGeneration } = useProjectsStore.getState();
      await getGeneration('proj-1', 'gen-1');

      // api.get tracks calls to the client directly (used by getJobProgress)
      // getGeneration uses generationsApi.getGeneration which is fully mocked
      // → api.get should NOT have been called during single fetch
      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe('Property-based: single fetch preserved across many inputs', () => {
    // For all inputs where NOT isBugCondition(input) (no apply in progress),
    // verify single fetch behavior is preserved.
    const testInputs = [
      { projectId: 'p1', genId: 'g1', pageName: 'LoginPage' },
      { projectId: 'p2', genId: 'g2', pageName: 'DashboardPage' },
      { projectId: 'project-abc', genId: 'gen-xyz', pageName: 'CheckoutPage' },
      { projectId: 'p-123', genId: 'g-456', pageName: 'ProfilePage' },
      { projectId: 'demo-project', genId: 'demo-gen', pageName: 'SearchPage' },
    ];

    testInputs.forEach(({ projectId, genId, pageName }) => {
      it(`getGeneration single fetch for project=${projectId}, gen=${genId}`, async () => {
        (generationsApi.getGeneration as jest.Mock).mockResolvedValueOnce({
          ...MOCK_GENERATION,
          id: genId,
          project_id: projectId,
          page_name: pageName,
        });

        const { getGeneration } = useProjectsStore.getState();
        const gen = await getGeneration(projectId, genId);

        expect(gen.id).toBe(genId);
        expect(gen.project_id).toBe(projectId);
        expect(gen.page_name).toBe(pageName);
        expect(generationsApi.getGeneration).toHaveBeenCalledWith(projectId, genId);
        // Still no job-status API calls during single fetch
        expect(api.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('Existing functionality preserved', () => {
    it('updateGenerationPageName preserves page rename behavior', async () => {
      const { updateGenerationPageName } = useProjectsStore.getState();
      await expect(
        updateGenerationPageName('proj-1', 'gen-1', 'RenamedPage')
      ).resolves.toBeUndefined();
    });

    it('deleteGeneration preserves delete behavior', async () => {
      const { deleteGeneration } = useProjectsStore.getState();
      await expect(deleteGeneration('proj-1', 'gen-1')).resolves.toBeUndefined();
    });

    it('getProject fetches project data for display alongside generation', async () => {
      const { getProject } = useProjectsStore.getState();
      const proj = await getProject('proj-1');
      expect(proj).toHaveProperty('id', 'proj-1');
      expect(proj).toHaveProperty('base_url');
    });

    it('fetchGenerations returns paginated list for navigation', async () => {
      const { fetchGenerations } = useProjectsStore.getState();
      const result = await fetchGenerations('proj-1');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('getGeneration and getProject can both be called in parallel (Promise.all pattern)', async () => {
      // This mirrors the useFocusEffect Promise.all in GenerationDetailScreen
      const { getGeneration, getProject } = useProjectsStore.getState();
      const [gen, proj] = await Promise.all([
        getGeneration('proj-1', 'gen-1'),
        getProject('proj-1'),
      ]);
      expect(gen).toHaveProperty('id');
      expect(proj).toHaveProperty('id');
      expect(generationsApi.getGeneration).toHaveBeenCalledTimes(1);
    });

    it('code format is preserved: page_code and test_code are non-empty strings', async () => {
      // Property: for any generation returned, code fields are always strings
      const inputs = [
        { projectId: 'p1', genId: 'g1' },
        { projectId: 'p2', genId: 'g2' },
        { projectId: 'p3', genId: 'g3' },
      ];
      for (const { projectId, genId } of inputs) {
        jest.clearAllMocks();
        (generationsApi.getGeneration as jest.Mock).mockResolvedValue({
          ...MOCK_GENERATION,
          id: genId,
          project_id: projectId,
        });
        const { getGeneration } = useProjectsStore.getState();
        const gen = await getGeneration(projectId, genId);
        expect(typeof gen.page_code).toBe('string');
        expect(typeof gen.test_code).toBe('string');
      }
    });
  });
});
