import { useState, useCallback, useRef } from 'react';

interface AsyncActionState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface AsyncActionReturn<T, A extends unknown[]> extends AsyncActionState<T> {
  run: (...args: A) => Promise<T | undefined>;
  reset: () => void;
}

export function useAsyncAction<T = void, A extends unknown[] = []>(
  action: (...args: A) => Promise<T>,
): AsyncActionReturn<T, A> {
  const [state, setState] = useState<AsyncActionState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });
  const mountedRef = useRef(true);

  const run = useCallback(
    async (...args: A): Promise<T | undefined> => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const result = await action(...args);
        if (mountedRef.current) {
          setState({ data: result, error: null, isLoading: false });
        }
        return result;
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'An unexpected error occurred';
        if (mountedRef.current) {
          setState({ data: null, error: message, isLoading: false });
        }
        throw err;
      }
    },
    [action],
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, run, reset };
}
