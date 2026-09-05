import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
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
      setToast(`Đang gọi ${result.person.name} — STT #${result.person.queueNumber}`);
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
      <header className="topbar topbar-simple">
        <div className="brand">Phỏng vấn · Bàn {tableNumber}</div>
      </header>

      <main className="view-main view-main-single">
        <div className="view-header">
          <div>
            <p className="eyebrow">Màn hình bàn {tableNumber}</p>
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
                <div className="table-person-meta">
                  STT #{current.queueNumber}
                  {current.msv ? ` · ${current.msv}` : ''}
                </div>
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
                    <div className="roster-info">
                      <span className="waiting-name">{person.name}</span>
                      {person.msv && (
                        <span className="roster-meta">{person.msv}</span>
                      )}
                    </div>
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
                Xác nhận gọi <strong>{nextWaiting.name}</strong> (STT #
                {nextWaiting.queueNumber}
                {nextWaiting.msv ? ` · ${nextWaiting.msv}` : ''}) vào{' '}
                <strong>Bàn {tableNumber}</strong>?
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
