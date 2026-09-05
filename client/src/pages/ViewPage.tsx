import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { callNext, completeInterview } from '../api';
import { useAppState } from '../hooks/useAppState';

export default function ViewPage() {
  const { tableId } = useParams();
  const tableNumber = Number(tableId);

  if (!Number.isInteger(tableNumber) || (tableNumber !== 1 && tableNumber !== 2)) {
    return <Navigate to="/view/1" replace />;
  }

  return <TableView tableNumber={tableNumber} />;
}

function TableView({ tableNumber }: { tableNumber: number }) {
  const { state, setState, error: loadError } = useAppState(tableNumber, 1500);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');

  const current = state.current ?? state.tables[0]?.person ?? null;
  const nextWaiting = state.nextWaiting ?? state.waiting[0] ?? null;
  const tableBusy = Boolean(current);
  const canCallNext = Boolean(nextWaiting) && !tableBusy && !busy;

  async function confirmNext() {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const result = await callNext(tableNumber);
      setState(result.state);
      setToast(`Đang gọi ${result.person.name} — số #${result.person.queueNumber}`);
      setConfirmOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không gọi được.');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (busy || !current) return;
    setBusy(true);
    setActionError('');
    try {
      const result = await completeInterview(tableNumber);
      setState(result.state);
      setToast('Đã hoàn thành. Có thể gọi người tiếp theo.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không cập nhật được.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page view-page">
      <header className="topbar">
        <div className="brand">Phỏng vấn</div>
        <nav>
          <Link to="/" className="nav-link">
            Check-in
          </Link>
          <Link
            to="/view/1"
            className={`nav-link ${tableNumber === 1 ? 'active' : ''}`}
          >
            Bàn 1
          </Link>
          <Link
            to="/view/2"
            className={`nav-link ${tableNumber === 2 ? 'active' : ''}`}
          >
            Bàn 2
          </Link>
        </nav>
      </header>

      <main className="view-main view-main-single">
        <div className="view-header">
          <div>
            <p className="eyebrow">Màn hình độc lập</p>
            <h1>Bàn {tableNumber}</h1>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!canCallNext}
            onClick={() => {
              setActionError('');
              setConfirmOpen(true);
            }}
          >
            Người tiếp theo
          </button>
        </div>

        {(loadError || actionError) && (
          <p className="banner-error">{actionError || loadError}</p>
        )}
        {toast && <p className="banner-ok">{toast}</p>}

        <section className="tables-grid tables-grid-single">
          <article className={`table-card ${current ? 'occupied' : 'free'}`}>
            <div className="table-card-head">
              <h2>Đang phỏng vấn</h2>
              <span className="status-pill">
                {current ? 'Đang phỏng vấn' : 'Trống'}
              </span>
            </div>
            {current ? (
              <>
                <div className="table-person-name">{current.name}</div>
                <div className="table-person-meta">Số #{current.queueNumber}</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={handleComplete}
                >
                  Hoàn thành
                </button>
              </>
            ) : (
              <p className="table-empty">Chưa có ứng viên tại bàn này</p>
            )}
          </article>
        </section>

        <section className="waiting-section">
          <div className="section-title-row">
            <h2>Chờ bàn {tableNumber}</h2>
            <span className="count-badge">{state.waiting.length}</span>
          </div>

          {state.waiting.length === 0 ? (
            <p className="empty-waiting">Không còn ai chờ bàn này.</p>
          ) : (
            <ul className="waiting-list">
              {state.waiting.map((person, index) => (
                <li key={person.id} className={index === 0 ? 'next-up' : ''}>
                  <div className="waiting-left">
                    <span className="queue-no">#{person.queueNumber}</span>
                    <span className="waiting-name">{person.name}</span>
                  </div>
                  {index === 0 && <span className="waiting-table">Tiếp theo</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {confirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h3 id="confirm-title">Gọi người tiếp theo?</h3>
            {nextWaiting ? (
              <p>
                Xác nhận gọi <strong>{nextWaiting.name}</strong> (số #
                {nextWaiting.queueNumber}) vào <strong>Bàn {tableNumber}</strong>?
              </p>
            ) : (
              <p>Không còn người chờ bàn này.</p>
            )}
            {actionError && <p className="form-error">{actionError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !nextWaiting || tableBusy}
                onClick={confirmNext}
              >
                {busy ? 'Đang gọi...' : 'Xác nhận gọi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
