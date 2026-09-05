import { useMemo, useState } from 'react';
import { cancelPerson, checkIn, resetAll } from '../api';
import { useAppState } from '../hooks/useAppState';
import type { Person } from '../types';

const STATUS_LABEL: Record<Person['status'], string> = {
  pending: 'Chưa đến',
  waiting: 'Đã check-in',
  interviewing: 'Đang PV',
  done: 'Xong',
};

export default function CheckInPage() {
  const { state, setState, error: loadError } = useAppState(undefined, 2000);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [lastPerson, setLastPerson] = useState<Person | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const people = state.people ?? [];
  const counts = state.counts;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.msv || '').toLowerCase().includes(q) ||
        String(p.classCode || '').toLowerCase().includes(q) ||
        String(p.queueNumber).includes(q)
    );
  }, [people, query]);

  async function handleCheckIn(person: Person) {
    if (busyId || person.status !== 'pending') return;
    setBusyId(person.id);
    setError('');
    try {
      const result = await checkIn(person.msv || person.id);
      setLastPerson(result.person);
      setState(result.state);
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
      if (lastPerson?.id === id) setLastPerson(null);
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
      setLastPerson(null);
      setResetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset thất bại.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="page checkin-page">
      <header className="topbar topbar-simple">
        <div className="brand">Phỏng vấn CTV VPĐ</div>
      </header>

      <main className="checkin-main checkin-main-wide">
        <section className="checkin-hero">
          <div className="checkin-hero-row">
            <div>
              <p className="eyebrow">Danh sách CSV · Check-in</p>
              <h1>Check-in</h1>
              <p className="lead">
                Check-in theo thứ tự đến. Chưa gán bàn — bàn chỉ gán khi được
                gọi ở màn hình bàn 1 / bàn 2.
              </p>
              {counts && (
                <p className="count-line">
                  Tổng {counts.total} · Chưa đến {counts.pending} · Đã check-in{' '}
                  {counts.waiting} · Đang PV {counts.interviewing} · Xong{' '}
                  {counts.done}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-danger-text"
              onClick={() => {
                setError('');
                setResetOpen(true);
              }}
            >
              Reset danh sách
            </button>
          </div>
        </section>

        <div className="checkin-form">
          <label htmlFor="search">Tìm theo tên / MSV / lớp / STT</label>
          <input
            id="search"
            type="search"
            placeholder="Nhập để lọc danh sách…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {(error || loadError) && (
            <p className="form-error">{error || loadError}</p>
          )}
        </div>

        {lastPerson && (
          <div className="ticket" role="status">
            <div className="ticket-label">Check-in thành công</div>
            <div className="ticket-name">{lastPerson.name}</div>
            <div className="ticket-meta">
              <div>
                <span>STT</span>
                <strong>#{lastPerson.queueNumber}</strong>
              </div>
              <div>
                <span>Bàn</span>
                <strong>Chờ gọi</strong>
              </div>
            </div>
            <p className="ticket-note">
              {lastPerson.msv}
              {lastPerson.startTime
                ? ` · ${lastPerson.startTime}–${lastPerson.endTime}`
                : ''}
            </p>
          </div>
        )}

        <section className="waiting-section checkin-list">
          <div className="section-title-row">
            <h2>Danh sách check-in</h2>
            <span className="count-badge">{filtered.length}</span>
          </div>

          {filtered.length === 0 ? (
            <p className="empty-waiting">Không có thí sinh khớp.</p>
          ) : (
            <ul className="waiting-list roster-list">
              {filtered.map((person) => (
                <li key={person.id} className={`roster-row status-row-${person.status}`}>
                  <div className="waiting-left roster-main">
                    <span className="queue-no">#{person.queueNumber}</span>
                    <div className="roster-info">
                      <span className="waiting-name">{person.name}</span>
                      <span className="roster-meta">
                        {person.msv}
                        {person.classCode ? ` · ${person.classCode}` : ''}
                        {person.startTime
                          ? ` · ${person.startTime}–${person.endTime}`
                          : ''}
                      </span>
                    </div>
                    <span className={`status-tag status-${person.status}`}>
                      {STATUS_LABEL[person.status]}
                    </span>
                  </div>
                  <div className="list-actions">
                    {person.tableNumber != null ? (
                      <span className="waiting-table">Bàn {person.tableNumber}</span>
                    ) : person.status === 'waiting' ? (
                      <span className="waiting-table">Chờ gọi</span>
                    ) : null}
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
                        className="btn-link-danger"
                        disabled={Boolean(busyId)}
                        onClick={() => handleCancel(person.id)}
                      >
                        {busyId === person.id ? '…' : 'Hủy CI'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {resetOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <h3 id="reset-title">Reset về CSV gốc?</h3>
            <p>
              Đưa toàn bộ thí sinh về trạng thái Chưa đến theo file CSV. Xóa hết
              check-in / đang PV / đã xong.
            </p>
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
                {resetting ? 'Đang reset...' : 'Xác nhận reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
