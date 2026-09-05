import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { checkIn } from '../api';
import type { Person } from '../types';

export default function CheckInPage() {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lastPerson, setLastPerson] = useState<Person | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const result = await checkIn(name.trim());
      setLastPerson(result.person);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in thất bại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page checkin-page">
      <header className="topbar">
        <div className="brand">Phỏng vấn</div>
        <nav>
          <Link to="/" className="nav-link active">
            Check-in
          </Link>
          <Link to="/view/1" className="nav-link">
            Bàn 1
          </Link>
          <Link to="/view/2" className="nav-link">
            Bàn 2
          </Link>
        </nav>
      </header>

      <main className="checkin-main">
        <section className="checkin-hero">
          <p className="eyebrow">Bàn 1 · Bàn 2</p>
          <h1>Check-in</h1>
          <p className="lead">
            Nhập họ tên để lấy số. Bàn được gán lần lượt: 1, 2, 1, 2…
          </p>
        </section>

        <form className="checkin-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Họ và tên</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Ví dụ: Nguyễn Văn An"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
            {submitting ? 'Đang check-in...' : 'Check-in'}
          </button>
        </form>

        {lastPerson && (
          <div className="ticket" role="status">
            <div className="ticket-label">Phiếu check-in</div>
            <div className="ticket-name">{lastPerson.name}</div>
            <div className="ticket-meta">
              <div>
                <span>Số thứ tự</span>
                <strong>#{lastPerson.queueNumber}</strong>
              </div>
              <div>
                <span>Bàn được gán</span>
                <strong>Bàn {lastPerson.tableNumber}</strong>
              </div>
            </div>
            <p className="ticket-note">Vui lòng chờ đến khi được gọi.</p>
          </div>
        )}
      </main>
    </div>
  );
}
