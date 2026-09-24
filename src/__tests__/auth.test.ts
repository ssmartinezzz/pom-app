/**
 * Auth Store Tests — BUG-C1: clearSession() token persistence bug
 *
 * Task 1: Bug Condition Exploration — FAILS on unfixed code (proves bug exists)
 * Task 2: Preservation Properties   — PASSES on unfixed code (confirms baseline)
 *
 * After fix (Tasks 3.3 & 3.4):
 *   Task 1 tests PASS  → bug is fixed
 *   Task 2 tests still PASS → no regressions
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────
// Variables prefixed with 'mock' are allowed inside jest.mock() factory scope.

const mockStorage: Record<string, string> = {};
const TOKEN_KEY = 'auth_token';
let mockRemoveTokenDelay = 0;

jest.mock('../utils/storage', () => ({
  getToken: jest.fn(async () => mockStorage[TOKEN_KEY] ?? null),
  setToken: jest.fn(async (token: string) => {
    mockStorage[TOKEN_KEY] = token;
  }),
  removeToken: jest.fn(async () => {
    if (mockRemoveTokenDelay > 0) {
      await new Promise<void>((res) => setTimeout(res, mockRemoveTokenDelay));
    }
    delete mockStorage[TOKEN_KEY];
  }),
}));

jest.mock('../api/auth', () => ({
  login: jest.fn(async ({ email }: { email: string }) => ({
    token: `token-for-${email}`,
    user: { id: '1', email, username: 'testuser', created_at: '2026-01-01' },
  })),
  register: jest.fn(async ({ email, username }: { email: string; username: string }) => ({
    token: `token-for-${email}`,
    user: { id: '1', email, username, created_at: '2026-01-01' },
  })),
  logout: jest.fn(async () => {}),
  getMe: jest.fn(async () => ({ id: '1', email: 'user@test.com', username: 'testuser', created_at: '2026-01-01' })),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { useAuthStore } from '../stores/auth';
import * as storageUtils from '../utils/storage';
import * as authApi from '../api/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetStore() {
  useAuthStore.setState({ user: null, token: null, isLoading: false, isReady: false });
}

function resetStorage() {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  mockRemoveTokenDelay = 0;
}

beforeEach(() => {
  resetStore();
  resetStorage();
  jest.clearAllMocks();
  // Re-bind implementations (clearAllMocks resets call counts but not impl)
  (storageUtils.getToken as jest.Mock).mockImplementation(async () => mockStorage[TOKEN_KEY] ?? null);
  (storageUtils.setToken as jest.Mock).mockImplementation(async (token: string) => {
    mockStorage[TOKEN_KEY] = token;
  });
  (storageUtils.removeToken as jest.Mock).mockImplementation(async () => {
    if (mockRemoveTokenDelay > 0) {
      await new Promise<void>((res) => setTimeout(res, mockRemoveTokenDelay));
    }
    delete mockStorage[TOKEN_KEY];
  });
  (authApi.login as jest.Mock).mockImplementation(async ({ email }: { email: string }) => ({
    token: `token-for-${email}`,
    user: { id: '1', email, username: 'testuser', created_at: '2026-01-01' },
  }));
  (authApi.register as jest.Mock).mockImplementation(
    async ({ email, username }: { email: string; username: string }) => ({
      token: `token-for-${email}`,
      user: { id: '1', email, username, created_at: '2026-01-01' },
    })
  );
  (authApi.logout as jest.Mock).mockImplementation(async () => {});
  (authApi.getMe as jest.Mock).mockImplementation(async () => ({
    id: '1',
    email: 'user@test.com',
    username: 'testuser',
    created_at: '2026-01-01',
  }));
});

// =============================================================================
// TASK 1 — BUG CONDITION EXPLORATION
// Property 1: clearSession() SHALL await removeToken() before clearing state
//
// EXPECTED on UNFIXED code: FAIL  (proves the bug exists)
// EXPECTED on FIXED code:   PASS  (confirms the bug is fixed)
// =============================================================================

describe('Task 1 — Bug Condition: clearSession() token removal completion', () => {
  it('clearSession() returns a Promise<void> [async function check]', () => {
    // UNFIXED: clearSession() is sync → returns undefined → FAIL
    // FIXED:   clearSession() is async → returns Promise → PASS
    const { clearSession } = useAuthStore.getState();
    const result = clearSession();
    expect(result).toBeInstanceOf(Promise);
    return result; // clean up floating promise
  });

  it('storage is clean after await clearSession() [race condition test]', async () => {
    // Arrange: token exists in both storage and state
    mockStorage[TOKEN_KEY] = 'my-secret-token';
    useAuthStore.setState({ token: 'my-secret-token', user: { id: '1', email: 'a@b.com', username: 'a', created_at: '2026-01-01' } });

    // Act: await clearSession()
    // UNFIXED: clearSession() is void — cannot actually be awaited; removeToken fires & forgets
    //          After the sync function returns, the removeToken() promise is unresolved
    // FIXED:   clearSession() is async — awaiting it waits for removeToken() to complete
    const { clearSession } = useAuthStore.getState();
    await clearSession();

    // Assert: token must be gone from storage
    // UNFIXED: mockStorage[TOKEN_KEY] still exists → FAIL (counterexample found)
    // FIXED:   mockStorage[TOKEN_KEY] is undefined → PASS
    expect(mockStorage[TOKEN_KEY]).toBeUndefined();
  });

  it('in-memory state and storage are synchronized after clearSession()', async () => {
    // Arrange
    mockStorage[TOKEN_KEY] = 'sync-test-token';
    useAuthStore.setState({ token: 'sync-test-token', user: { id: '2', email: 'b@c.com', username: 'b', created_at: '2026-01-01' } });

    // Act
    const { clearSession } = useAuthStore.getState();
    await clearSession();

    // Assert: both state AND storage must be clean — not just state
    // UNFIXED: state is null but storage still has token → desync → FAIL
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(mockStorage[TOKEN_KEY]).toBeUndefined();
  });

  it('storage is clean after clearSession() even with delayed removeToken()', async () => {
    // Arrange: slow removeToken to simulate SecureStore async latency
    mockRemoveTokenDelay = 50;
    mockStorage[TOKEN_KEY] = 'delayed-token';
    useAuthStore.setState({ token: 'delayed-token', user: { id: '3', email: 'c@d.com', username: 'c', created_at: '2026-01-01' } });

    // Act: await the result of clearSession()
    const { clearSession } = useAuthStore.getState();
    await clearSession();

    // Assert: after the await resolves, storage must be clean
    // UNFIXED: clearSession() returns void, so `await undefined` resolves immediately
    //          before the 50ms removeToken() finishes → mockStorage[TOKEN_KEY] still set → FAIL
    // FIXED:   clearSession() returns the removeToken() promise, so await properly waits → PASS
    expect(mockStorage[TOKEN_KEY]).toBeUndefined();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('removeToken() is called exactly once during clearSession()', async () => {
    mockStorage[TOKEN_KEY] = 'token-xyz';

    const { clearSession } = useAuthStore.getState();
    await clearSession();

    expect(storageUtils.removeToken).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// TASK 2 — PRESERVATION PROPERTY TESTS
// Property 2: All auth ops EXCEPT clearSession() must behave exactly as before
//
// EXPECTED on UNFIXED code: PASS  (establishes baseline)
// EXPECTED on FIXED code:   PASS  (confirms no regressions)
// =============================================================================

describe('Task 2 — Preservation: existing auth operations unchanged', () => {
  // ── logout() ────────────────────────────────────────────────────────────────
  describe('logout()', () => {
    it('calls the API logout endpoint', async () => {
      await useAuthStore.getState().logout();
      expect(authApi.logout).toHaveBeenCalledTimes(1);
    });

    it('awaits removeToken() — storage is clean after logout()', async () => {
      mockStorage[TOKEN_KEY] = 'logout-token';
      await useAuthStore.getState().logout();
      expect(mockStorage[TOKEN_KEY]).toBeUndefined();
    });

    it('clears user and token from state', async () => {
      useAuthStore.setState({ user: { id: '1', email: 'a@b.com', username: 'a', created_at: '2026-01-01' }, token: 'tok' });
      await useAuthStore.getState().logout();
      const { user, token } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(token).toBeNull();
    });

    it('succeeds even when API call throws (error is swallowed)', async () => {
      (authApi.logout as jest.Mock).mockRejectedValueOnce(new Error('network error'));
      mockStorage[TOKEN_KEY] = 'resilient-token';
      await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
      expect(mockStorage[TOKEN_KEY]).toBeUndefined();
    });
  });

  // ── init() ──────────────────────────────────────────────────────────────────
  describe('init()', () => {
    it('sets isReady=true when no token in storage', async () => {
      await useAuthStore.getState().init();
      expect(useAuthStore.getState().isReady).toBe(true);
    });

    it('loads user and sets token when token exists in storage', async () => {
      mockStorage[TOKEN_KEY] = 'existing-token';
      await useAuthStore.getState().init();
      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.token).toBe('existing-token');
      expect(state.isReady).toBe(true);
    });

    it('awaits removeToken() and clears state when getMe() fails', async () => {
      mockStorage[TOKEN_KEY] = 'bad-token';
      (authApi.getMe as jest.Mock).mockRejectedValueOnce(new Error('401'));
      await useAuthStore.getState().init();
      expect(mockStorage[TOKEN_KEY]).toBeUndefined();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isReady).toBe(true);
    });
  });

  // ── login() ─────────────────────────────────────────────────────────────────
  describe('login()', () => {
    it('awaits setToken() before updating state', async () => {
      await useAuthStore.getState().login('user@test.com', 'password123');
      expect(storageUtils.setToken).toHaveBeenCalledWith('token-for-user@test.com');
      const state = useAuthStore.getState();
      expect(state.token).toBe('token-for-user@test.com');
      expect(state.user).not.toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('clears isLoading and rethrows on API failure', async () => {
      (authApi.login as jest.Mock).mockRejectedValueOnce(new Error('wrong password'));
      await expect(useAuthStore.getState().login('bad@test.com', 'wrong')).rejects.toThrow('wrong password');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // ── register() ──────────────────────────────────────────────────────────────
  describe('register()', () => {
    it('awaits setToken() before updating state', async () => {
      await useAuthStore.getState().register('newuser', 'new@test.com', 'pass123');
      expect(storageUtils.setToken).toHaveBeenCalledWith('token-for-new@test.com');
      const state = useAuthStore.getState();
      expect(state.token).toBe('token-for-new@test.com');
      expect(state.user).not.toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('clears isLoading and rethrows on API failure', async () => {
      (authApi.register as jest.Mock).mockRejectedValueOnce(new Error('email taken'));
      await expect(
        useAuthStore.getState().register('x', 'taken@test.com', 'pass')
      ).rejects.toThrow('email taken');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // ── Store state structure ────────────────────────────────────────────────────
  describe('store state structure', () => {
    it('has all expected properties and action functions', () => {
      const state = useAuthStore.getState();
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('token');
      expect(state).toHaveProperty('isLoading');
      expect(state).toHaveProperty('isReady');
      expect(typeof state.init).toBe('function');
      expect(typeof state.login).toBe('function');
      expect(typeof state.register).toBe('function');
      expect(typeof state.logout).toBe('function');
      expect(typeof state.clearSession).toBe('function');
    });

    it('initial state values are null/false', () => {
      const { user, token, isLoading, isReady } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(token).toBeNull();
      expect(isLoading).toBe(false);
      expect(isReady).toBe(false);
    });
  });
});
