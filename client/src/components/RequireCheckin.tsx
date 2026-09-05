import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchMe } from '../api';
import { clearToken, getToken, isLoggedIn } from '../auth';

export default function RequireCheckin({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isLoggedIn()) {
        if (!cancelled) {
          setOk(false);
          setReady(true);
        }
        return;
      }
      try {
        await fetchMe();
        if (!cancelled) setOk(true);
      } catch {
        clearToken();
        if (!cancelled) setOk(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="page">
        <header className="topbar topbar-desk">
          <div className="brand">Check-in · CTV VPĐ</div>
        </header>
        <p className="empty-waiting">Đang kiểm tra phiên đăng nhập…</p>
      </div>
    );
  }

  if (!ok || !getToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
