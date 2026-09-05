import { useCallback, useEffect, useState } from 'react';
import { fetchState } from '../api';
import type { AppState } from '../types';

const EMPTY: AppState = {
  tables: [
    { tableNumber: 1, person: null },
    { tableNumber: 2, person: null },
  ],
  waiting: [],
  interviewing: [],
  pending: [],
  people: [],
  tableCount: 2,
  tableNumber: null,
  current: null,
  nextWaiting: null,
};

export function useAppState(tableNumber?: number, pollMs = 1500) {
  const [state, setState] = useState<AppState>(() =>
    tableNumber != null
      ? {
          ...EMPTY,
          tables: [{ tableNumber, person: null }],
          tableNumber,
        }
      : EMPTY
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchState(tableNumber);
      setState(next);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [tableNumber]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { state, setState, error, loading, refresh };
}
