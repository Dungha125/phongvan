import { useEffect, useMemo, useState } from 'react';
import { cancelPerson, checkIn, resetAll } from '../api';
import { useAppState } from '../hooks/useAppState';
import type { Person, PersonStatus } from '../types';

const STATUS_LABEL: Record<PersonStatus, string> = {
  pending: 'Chưa đến',
  waiting: 'Đã CI',
  interviewing: 'Đang PV',
  done: 'Xong',
};

type FilterKey = 'all' | PersonStatus;

export default function CheckInPage() {
  const { state, setState, error: loadError } = useAppState(undefined, 2000);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const people = state.people ?? [];
  const counts = state.counts;

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        String(p.msv || '').toLowerCase().includes(q) ||
        String(p.classCode || '').toLowerCase().includes(q) ||
        String(p.queueNumber).includes(q)
      );
    });
  }, [people, query, filter]);

  async function handleCheckIn(person: Person) {
    if (busyId || person.status !== 'pending') return;
    setBusyId(person.id);
    setError('');
    try {
      const result = await checkIn(person.msv || person.id);
      setState(result.state);
      setToast(`Đã check-in: ${result.person.name} (STT #${result.person.queueNumber})`);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in thất bại.');
    } finally {
      setBusyId('');
    }
  }

  async function handleCancel(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      const result = await cancelPerson(id);
      setState(result.state);
      setToast(`Đã hủy check-in: ${result.person.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không hủy được.');
    } finally {
      setBusyId('');
    }
  }

  async function handleReset() {
    setResetting(true);
    setError('');
    try {
      const next = await resetAll();
      setState(next);
      setToast('Đã reset về danh sách CSV.');
      setResetOpen(false);
      setFilter('all');
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset thất bại.');
    } finally {
      setResetting(false);
    }
  }

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'Tất cả', count: counts?.total ?? people.length },
    { key: 'pending', label: 'Chưa đến', count: counts?.pending ?? 0 },
    { key: 'waiting', label: 'Đã CI', count: counts?.waiting ?? 0 },
    { key: 'interviewing', label: 'Đang PV', count: counts?.interviewing ?? 0 },
    { key: 'done', label: 'Xong', count: counts?.done ?? 0 },
  ];

  return (
    <div className="page checkin-page">
      <header className="topbar topbar-desk">
        <div className="brand">Check-in · CTV VPĐ</div>
        <button
          type="button"
          className="topbar-reset"
          onClick={() => {
            setError('');
            setResetOpen(true);
          }}
        >
          Reset
        </button>
      </header>

      <div className="desk-shell">
        <div className="desk-toolbar">
          <div className="search-wrap">
            <label htmlFor="search" className="sr-only">
              Tìm thí sinh
            </label>
            <input
              id="search"
              type="search"
              className="search-input"
              placeholder="Tìm tên, MSV, lớp, STT…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Xóa tìm kiếm"
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-row" role="tablist" aria-label="Lọc trạng thái">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={`filter-chip ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {(error || loadError) && (
          <p className="banner-error">{error || loadError}</p>
        )}
        {toast && <p className="banner-ok">{toast}</p>}

        <section className="roster-panel">
          <div className="roster-panel-head">
            <h1>Danh sách</h1>
            <span className="roster-count">
              {filtered.length}/{people.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="empty-waiting">Không có thí sinh khớp bộ lọc.</p>
          ) : (
            <div className="roster-table-wrap">
              <table className="roster-table">
                <thead>
                  <tr>
                    <th className="col-stt">STT</th>
                    <th>Họ tên</th>
                    <th className="col-hide-sm">MSV</th>
                    <th className="col-hide-md">Ca</th>
                    <th>TT</th>
                    <th className="col-action" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((person) => (
                    <tr key={person.id} className={`row-${person.status}`}>
                      <td className="col-stt">{person.queueNumber}</td>
                      <td>
                        <div className="cell-name">{person.name}</div>
                        <div className="cell-sub col-show-sm">
                          {person.msv}
                          {person.classCode ? ` · ${person.classCode}` : ''}
                        </div>
                      </td>
                      <td className="col-hide-sm mono">{person.msv}</td>
                      <td className="col-hide-md mono">
                        {person.startTime
                          ? `${person.startTime}–${person.endTime}`
                          : '—'}
                      </td>
                      <td>
                        <span className={`status-tag status-${person.status}`}>
                          {STATUS_LABEL[person.status]}
                          {person.tableNumber != null
                            ? ` · B${person.tableNumber}`
                            : ''}
                        </span>
                      </td>
                      <td className="col-action">
                        {person.status === 'pending' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={Boolean(busyId)}
                            onClick={() => handleCheckIn(person)}
                          >
                            {busyId === person.id ? '…' : 'Check-in'}
                          </button>
                        )}
                        {person.status === 'waiting' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={Boolean(busyId)}
                            onClick={() => handleCancel(person.id)}
                          >
                            {busyId === person.id ? '…' : 'Hủy'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {resetOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Reset danh sách?</h3>
            <p>Đưa mọi thí sinh về «Chưa đến» theo CSV. Mất hết check-in hiện tại.</p>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={resetting}
                onClick={() => setResetOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={resetting}
                onClick={handleReset}
              >
                {resetting ? 'Đang reset…' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
