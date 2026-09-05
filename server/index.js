const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const TABLE_COUNT = 2;

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

/** Serializes all read-modify-write so concurrent /next from 2 tables never corrupt state. */
let writeChain = Promise.resolve();

function withLock(fn) {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function defaultData() {
  return {
    nextQueueNumber: 1,
    nextTableIndex: 0,
    people: [],
  };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {
    /* fall through */
  }
  return defaultData();
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
  const waitingAll = data.people
    .filter((p) => p.status === 'waiting')
    .sort((a, b) => a.queueNumber - b.queueNumber);

  const interviewingAll = data.people
    .filter((p) => p.status === 'interviewing')
    .sort((a, b) => a.tableNumber - b.tableNumber);

  const tables = Array.from({ length: TABLE_COUNT }, (_, i) => {
    const num = i + 1;
    return {
      tableNumber: num,
      person: interviewingAll.find((p) => p.tableNumber === num) || null,
    };
  });

  if (tableNumber == null) {
    return {
      tables,
      waiting: waitingAll,
      interviewing: interviewingAll,
      tableCount: TABLE_COUNT,
      tableNumber: null,
    };
  }

  const table = tables.find((t) => t.tableNumber === tableNumber);
  const waiting = waitingAll.filter((p) => p.tableNumber === tableNumber);

  return {
    tables: [table],
    waiting,
    interviewing: table.person ? [table.person] : [],
    tableCount: TABLE_COUNT,
    tableNumber,
    current: table.person,
    nextWaiting: waiting[0] || null,
  };
}

app.get('/api/state', (_req, res) => {
  res.json(snapshot(loadData()));
});

app.get('/api/state/:tableNumber', (req, res) => {
  const tableNumber = parseTableNumber(req.params.tableNumber);
  if (!tableNumber) {
    return res.status(400).json({ error: 'Bàn không hợp lệ. Chỉ có bàn 1 và bàn 2.' });
  }
  res.json(snapshot(loadData(), tableNumber));
});

app.post('/api/checkin', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Vui lòng nhập họ tên.' });
  }

  try {
    const result = await withLock(() => {
      const data = loadData();
      const tableNumber = (data.nextTableIndex % TABLE_COUNT) + 1;
      const person = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        queueNumber: data.nextQueueNumber,
        tableNumber,
        status: 'waiting',
        checkedInAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      };

      data.people.push(person);
      data.nextQueueNumber += 1;
      data.nextTableIndex += 1;
      saveData(data);

      return { person, state: snapshot(data) };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Check-in thất bại.' });
  }
});

/**
 * Gọi người tiếp theo cho đúng 1 bàn.
 * Hàng đợi tách theo tableNumber → bàn 1 và bàn 2 gọi cùng lúc không tranh cùng 1 người.
 * Mutex + kiểm tra lại status tránh double-click / race trên cùng bàn.
 */
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
        .filter((p) => p.status === 'waiting' && p.tableNumber === tableNumber)
        .sort((a, b) => a.queueNumber - b.queueNumber)[0];

      if (!nextPerson) {
        const error = new Error(`Bàn ${tableNumber} không còn người chờ.`);
        error.status = 400;
        throw error;
      }

      // CAS: chỉ nhận nếu vẫn đang waiting (phòng trường hợp bất thường)
      if (nextPerson.status !== 'waiting') {
        const error = new Error('Người này vừa được gọi bởi thao tác khác. Thử lại.');
        error.status = 409;
        throw error;
      }

      nextPerson.status = 'interviewing';
      nextPerson.startedAt = new Date().toISOString();
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

app.post('/api/reset', async (_req, res) => {
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

app.listen(PORT, () => {
  console.log(`Interview check-in API: http://localhost:${PORT}`);
});
