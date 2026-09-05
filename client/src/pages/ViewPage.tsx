import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function confirmNext() {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const result = await callNext(tableNumber);
      setState(result.state);
      setToast(`Đã gọi ${result.person.name}`);
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
      setToast('Đã hoàn thành. Có thể gọi người tiếp.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không cập nhật được.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page view-page">
      <header className="topbar topbar-desk">
        <div className="brand">Bàn {tableNumber}</div>
        <div className="topbar-meta">
          Chờ: <strong>{state.waiting.length}</strong>
        </div>
      </header>

      <div className="board-shell">
        {(loadError || actionError) && (
          <p className="banner-error">{actionError || loadError}</p>
        )}
        {toast && <p className="banner-ok">{toast}</p>}

        <section className={`now-panel ${current ? 'has-person' : 'is-empty'}`}>
          <div className="now-label">
            {current ? 'Đang phỏng vấn' : 'Bàn trống'}
          </div>

          {current ? (
            <>
              <h1 className="now-name">{current.name}</h1>
              <p className="now-meta">
                STT #{current.queueNumber}
                {current.msv ? ` · ${current.msv}` : ''}
                {current.classCode ? ` · ${current.classCode}` : ''}
              </p>
              <div className="now-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={busy}
                  onClick={handleComplete}
                >
                  Hoàn thành
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="now-name muted-name">Chưa có ứng viên</h1>
              <p className="now-meta">
                {nextWaiting
                  ? `Người tiếp theo trong hàng chờ: ${nextWaiting.name}`
                  : 'Chưa có ai check-in.'}
              </p>
              <div className="now-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={!canCallNext}
                  onClick={() => {
                    setActionError('');
                    setConfirmOpen(true);
                  }}
                >
                  Gọi người tiếp theo
                </button>
              </div>
            </>
          )}
        </section>

        {current && (
          <section className="next-strip">
            <div className="next-strip-info">
              <span className="next-strip-label">Tiếp theo</span>
              {nextWaiting ? (
                <strong>
                  {nextWaiting.name}
                  <span className="mono">
                    {' '}
                    · #{nextWaiting.queueNumber}
                    {nextWaiting.msv ? ` · ${nextWaiting.msv}` : ''}
                  </span>
                </strong>
              ) : (
                <strong className="muted-name">Hết hàng chờ</strong>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!canCallNext}
              title={
                tableBusy
                  ? 'Hoàn thành người hiện tại trước'
                  : !nextWaiting
                    ? 'Không còn người chờ'
                    : undefined
              }
              onClick={() => {
                setActionError('');
                setConfirmOpen(true);
              }}
            >
              Gọi tiếp
            </button>
          </section>
        )}

        <section className="queue-panel">
          <div className="queue-panel-head">
            <h2>Hàng chờ</h2>
            <span className="count-badge">{state.waiting.length}</span>
          </div>

          {state.waiting.length === 0 ? (
            <p className="empty-waiting">Không có ai đang chờ.</p>
          ) : (
            <ol className="queue-list">
              {state.waiting.map((person, index) => (
                <li key={person.id} className={index === 0 ? 'is-next' : ''}>
                  <span className="queue-pos">{index + 1}</span>
                  <div className="queue-body">
                    <span className="queue-name">{person.name}</span>
                    <span className="queue-sub mono">
                      STT #{person.queueNumber}
                      {person.msv ? ` · ${person.msv}` : ''}
                    </span>
                  </div>
                  {index === 0 && <span className="queue-flag">Sẽ gọi</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {confirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Gọi vào bàn {tableNumber}?</h3>
            {nextWaiting ? (
              <p>
                <strong>{nextWaiting.name}</strong>
                <br />
                STT #{nextWaiting.queueNumber}
                {nextWaiting.msv ? ` · ${nextWaiting.msv}` : ''}
              </p>
            ) : (
              <p>Không còn người chờ.</p>
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
                {busy ? 'Đang gọi…' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
