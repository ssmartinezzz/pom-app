import { useState, useCallback } from 'react';

export function useRefresh(onRefreshAction: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshAction();
    } catch {
      // swallow — caller handles errors
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshAction]);

  return { refreshing, onRefresh };
}
