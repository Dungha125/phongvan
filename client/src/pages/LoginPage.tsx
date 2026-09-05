import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { login } from '../api';
import { isLoggedIn, setToken } from '../auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('checkin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoggedIn()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await login(username.trim(), password);
      setToken(result.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page login-page">
      <header className="topbar topbar-desk">
        <div className="brand">Check-in · CTV VPĐ</div>
      </header>

      <main className="login-shell">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Đăng nhập check-in</h1>
          <p className="login-lead">
            Chỉ tài khoản check-in mới thao tác được danh sách thí sinh.
          </p>

          <label htmlFor="username">Tài khoản</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />

          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoFocus
          />

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </main>
    </div>
  );
}
