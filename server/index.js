const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const ROSTER_FILE =
  process.env.ROSTER_FILE || path.join(__dirname, 'roster.csv');
const TABLE_COUNT = 2;

const CHECKIN_USERNAME = process.env.CHECKIN_USERNAME || 'checkin';
const CHECKIN_PASSWORD = process.env.CHECKIN_PASSWORD || 'CtvCheckin@2026';
const AUTH_SECRET =
  process.env.AUTH_SECRET || 'pv-checkin-secret-change-me-in-prod';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12h

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const allowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const pad = body.length % 4 === 0 ? '' : '='.repeat(4 - (body.length % 4));
    const json = Buffer.from(
      body.replace(/-/g, '+').replace(/_/g, '/') + pad,
      'base64'
    ).toString('utf8');
    const payload = JSON.parse(json);
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (payload.role !== 'checkin') return null;
    return payload;
  } catch {
    return null;
  }
}

function requireCheckin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Cần đăng nhập tài khoản check-in.' });
  }
  req.auth = payload;
  next();
}

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (username !== CHECKIN_USERNAME || password !== CHECKIN_PASSWORD) {
    return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' });
  }
  const token = signToken({
    role: 'checkin',
    username,
    exp: Date.now() + TOKEN_TTL_MS,
  });
  res.json({ token, username, role: 'checkin' });
});

app.get('/api/auth/me', requireCheckin, (req, res) => {
  res.json({ username: req.auth.username, role: req.auth.role });
});

let writeChain = Promise.resolve();

function withLock(fn) {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function loadRosterFromCsv() {
  if (!fs.existsSync(ROSTER_FILE)) {
    throw new Error(`Không tìm thấy file roster: ${ROSTER_FILE}`);
  }
  const raw = fs.readFileSync(ROSTER_FILE, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error('File CSV roster trống.');
  }

  const people = [];
  for (let i = 1; i < lines.length; i += 1) {
    const [
      sttRaw,
      name,
      msv,
      classCode,
      startTime,
      endTime,
    ] = parseCsvLine(lines[i]);
    const stt = Number(sttRaw);
    if (!name || !msv || !Number.isInteger(stt)) continue;
    people.push({
      id: String(msv).trim().toUpperCase(),
      stt,
      name: name.trim(),
      msv: String(msv).trim(),
      classCode: (classCode || '').trim(),
      startTime: (startTime || '').trim(),
      endTime: (endTime || '').trim(),
      queueNumber: stt,
      tableNumber: null,
      status: 'pending',
      note: '',
      checkedInAt: null,
      startedAt: null,
      finishedAt: null,
    });
  }

  if (people.length === 0) {
    throw new Error('Không parse được thí sinh nào từ CSV.');
  }

  return { people, lastCall: null };
}

function defaultData() {
  return loadRosterFromCsv();
}

function sortWaiting(a, b) {
  const ta = a.checkedInAt || '';
  const tb = b.checkedInAt || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.queueNumber - b.queueNumber;
}

function normalizePeople(data) {
  // Chưa gọi bàn thì không giữ bàn đã gán sẵn (data cũ / CSV cũ).
  for (const p of data.people) {
    if (p.status === 'pending' || p.status === 'waiting') {
      p.tableNumber = null;
    }
  }
  return data;
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (Array.isArray(data.people) && data.people.length > 0) {
        return normalizePeople(data);
      }
    }
  } catch {
    /* fall through */
  }
  const data = defaultData();
  saveData(data);
  return data;
}

function saveData(data) {
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function parseTableNumber(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > TABLE_COUNT) {
    return null;
  }
  return n;
}

function snapshot(data, tableNumber = null) {
  const people = data.people
    .slice()
    .sort((a, b) => a.queueNumber - b.queueNumber);

  const waitingAll = people
    .filter((p) => p.status === 'waiting')
    .sort(sortWaiting);
  const interviewingAll = people.filter((p) => p.status === 'interviewing');
  const pendingAll = people.filter((p) => p.status === 'pending');

  const tables = Array.from({ length: TABLE_COUNT }, (_, i) => {
    const num = i + 1;
    return {
      tableNumber: num,
      person: interviewingAll.find((p) => p.tableNumber === num) || null,
    };
  });

  const base = {
    tables,
    waiting: waitingAll,
    interviewing: interviewingAll,
    pending: pendingAll,
    people,
    lastCall: data.lastCall || null,
    tableCount: TABLE_COUNT,
    counts: {
      total: people.length,
      pending: pendingAll.length,
      waiting: waitingAll.length,
      interviewing: interviewingAll.length,
      done: people.filter((p) => p.status === 'done').length,
    },
  };

  if (tableNumber == null) {
    return { ...base, tableNumber: null };
  }

  const table = tables.find((t) => t.tableNumber === tableNumber);
  // Hàng chờ chung — bàn nào gọi trước lấy người đến trước (FIFO check-in).
  return {
    ...base,
    tables: [table],
    waiting: waitingAll,
    interviewing: table.person ? [table.person] : [],
    tableNumber,
    current: table.person,
    nextWaiting: waitingAll[0] || null,
  };
}

app.get('/api/state', (_req, res) => {
  try {
    res.json(snapshot(loadData()));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Không tải được dữ liệu.' });
  }
});

app.get('/api/state/:tableNumber', (req, res) => {
  const tableNumber = parseTableNumber(req.params.tableNumber);
  if (!tableNumber) {
    return res.status(400).json({ error: 'Bàn không hợp lệ. Chỉ có bàn 1 và bàn 2.' });
  }
  try {
    res.json(snapshot(loadData(), tableNumber));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Không tải được dữ liệu.' });
  }
});

/** Check-in theo MSV hoặc id trong CSV. */
app.post('/api/checkin', requireCheckin, async (req, res) => {
  const key = String(req.body?.msv || req.body?.id || req.body?.name || '')
    .trim()
    .toUpperCase();
  if (!key) {
    return res.status(400).json({ error: 'Vui lòng chọn thí sinh trong danh sách CSV.' });
  }

  try {
    const result = await withLock(() => {
      const data = loadData();
      const person =
        data.people.find((p) => p.id === key || String(p.msv).toUpperCase() === key) ||
        data.people.find(
          (p) => p.name.trim().toUpperCase() === String(req.body?.name || '').trim().toUpperCase()
        );

      if (!person) {
        const error = new Error('Thí sinh không có trong danh sách CSV.');
        error.status = 404;
        throw error;
      }
      if (person.status === 'waiting') {
        const error = new Error(`${person.name} đã check-in rồi.`);
        error.status = 409;
        throw error;
      }
      if (person.status === 'interviewing') {
        const error = new Error(`${person.name} đang phỏng vấn.`);
        error.status = 409;
        throw error;
      }
      if (person.status === 'done') {
        const error = new Error(`${person.name} đã hoàn thành phỏng vấn.`);
        error.status = 409;
        throw error;
      }

      person.status = 'waiting';
      person.tableNumber = null;
      person.checkedInAt = new Date().toISOString();
      saveData(data);

      return { person, state: snapshot(data) };
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Check-in thất bại.' });
  }
});

app.post('/api/tables/:tableNumber/next', async (req, res) => {
  const tableNumber = parseTableNumber(req.params.tableNumber);
  if (!tableNumber) {
    return res.status(400).json({ error: 'Bàn không hợp lệ. Chỉ có bàn 1 và bàn 2.' });
  }

  try {
    const result = await withLock(() => {
      const data = loadData();

      const current = data.people.find(
        (p) => p.status === 'interviewing' && p.tableNumber === tableNumber
      );
      if (current) {
        const error = new Error(
          `Bàn ${tableNumber} đang phỏng vấn ${current.name}. Hãy hoàn thành trước.`
        );
        error.status = 409;
        throw error;
      }

      const nextPerson = data.people
        .filter((p) => p.status === 'waiting')
        .sort(sortWaiting)[0];

      if (!nextPerson) {
        const error = new Error('Không còn người chờ phỏng vấn.');
        error.status = 400;
        throw error;
      }

      if (nextPerson.status !== 'waiting') {
        const error = new Error('Người này vừa được gọi bởi thao tác khác. Thử lại.');
        error.status = 409;
        throw error;
      }

      nextPerson.status = 'interviewing';
      nextPerson.tableNumber = tableNumber;
      nextPerson.startedAt = new Date().toISOString();
      data.lastCall = {
        id: nextPerson.id,
        name: nextPerson.name,
        msv: nextPerson.msv,
        queueNumber: nextPerson.queueNumber,
        tableNumber,
        calledAt: nextPerson.startedAt,
      };
      saveData(data);

      return { person: nextPerson, state: snapshot(data, tableNumber) };
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Không gọi được.' });
  }
});

app.post('/api/tables/:tableNumber/complete', async (req, res) => {
  const tableNumber = parseTableNumber(req.params.tableNumber);
  if (!tableNumber) {
    return res.status(400).json({ error: 'Bàn không hợp lệ. Chỉ có bàn 1 và bàn 2.' });
  }

  try {
    const result = await withLock(() => {
      const data = loadData();
      const person = data.people.find(
        (p) => p.status === 'interviewing' && p.tableNumber === tableNumber
      );

      if (!person) {
        const error = new Error(`Bàn ${tableNumber} không có ai đang phỏng vấn.`);
        error.status = 409;
        throw error;
      }

      person.status = 'done';
      person.finishedAt = new Date().toISOString();
      saveData(data);

      return { person, state: snapshot(data, tableNumber) };
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Không cập nhật được.' });
  }
});

/** Reset về danh sách CSV gốc. */
app.post('/api/reset', requireCheckin, async (_req, res) => {
  try {
    const state = await withLock(() => {
      const data = defaultData();
      saveData(data);
      return snapshot(data);
    });
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Reset thất bại.' });
  }
});

/** Hủy check-in nhầm → trả về pending (vẫn giữ trong CSV). */
app.delete('/api/people/:id', requireCheckin, async (req, res) => {
  try {
    const result = await withLock(() => {
      const data = loadData();
      const key = String(req.params.id || '').trim().toUpperCase();
      const person = data.people.find(
        (p) => p.id === key || String(p.msv).toUpperCase() === key
      );
      if (!person) {
        const error = new Error('Không tìm thấy thí sinh.');
        error.status = 404;
        throw error;
      }
      if (person.status !== 'waiting') {
        const error = new Error(
          'Chỉ hủy được người đang chờ. Người đang/đã phỏng vấn không hủy bằng cách này.'
        );
        error.status = 409;
        throw error;
      }
      person.status = 'pending';
      person.tableNumber = null;
      person.checkedInAt = null;
      saveData(data);
      return { person, state: snapshot(data) };
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Không hủy được.' });
  }
});

try {
  loadData();
  console.log(`Roster loaded from ${ROSTER_FILE}`);
} catch (err) {
  console.error('Roster load warning:', err.message);
}

app.listen(PORT, () => {
  console.log(`Interview check-in API: http://localhost:${PORT}`);
  console.log(`Check-in user: ${CHECKIN_USERNAME}`);
});
