import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuid } from 'uuid';

type Permission = 'portal.download' | 'admin.users' | 'admin.software';
type Role = 'admin' | 'user';
type VersionChannel = 'release' | 'beta' | 'history';

interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  permissions: Permission[];
  enabled: boolean;
  createdAt: string;
}

interface SoftwarePackage {
  id: string;
  name: string;
  description: string;
  version: string;
  channel: VersionChannel;
  fileName: string;
  originalName: string;
  size: number;
  createdAt: string;
  published: boolean;
}

interface Database {
  users: User[];
  packages: SoftwarePackage[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const webDistDir = path.join(__dirname, '..', 'dist');
const dbPath = path.join(dataDir, 'db.json');
const jwtSecret = process.env.JWT_SECRET || 'packhub-dev-secret';
const port = Number(process.env.PORT || 3001);
const permissions: Permission[] = ['portal.download', 'admin.users', 'admin.software'];

function ensureStorage() {
  for (const dir of [dataDir, uploadsDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

async function writeDb(db: Database) {
  ensureStorage();
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

async function readDb(): Promise<Database> {
  ensureStorage();
  if (!existsSync(dbPath)) {
    const db: Database = {
      users: [
        {
          id: uuid(),
          username: 'admin',
          displayName: '系统管理员',
          passwordHash: await bcrypt.hash('admin123', 10),
          role: 'admin',
          permissions,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
      packages: [],
    };
    await writeDb(db);
    return db;
  }
  return JSON.parse(await fs.readFile(dbPath, 'utf-8')) as Database;
}

function safeUser(user: User) {
  const { passwordHash: _passwordHash, ...result } = user;
  return result;
}

function createToken(user: User) {
  return jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '8h' });
}

async function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : queryToken;
    const payload = jwt.verify(token, jwtSecret) as { userId: string };
    const db = await readDb();
    const user = db.users.find((item) => item.id === payload.userId && item.enabled);
    if (!user) return res.status(401).json({ message: '登录已失效' });
    res.locals.user = user;
    next();
  } catch {
    res.status(401).json({ message: '请先登录' });
  }
}

function requirePermission(permission: Permission) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.user as User;
    if (!user.permissions.includes(permission)) {
      return res.status(403).json({ message: '权限不足' });
    }
    next();
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureStorage();
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${uuid()}${path.extname(file.originalname) || '.zip'}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      cb(new Error('仅支持上传 .zip 安装包'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 1024 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const db = await readDb();
  const user = db.users.find((item) => item.username === username && item.enabled);
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ message: '账号或密码错误' });
  }
  res.json({ token: createToken(user), user: safeUser(user) });
});

app.get('/api/auth/me', auth, (_req, res) => {
  res.json({ user: safeUser(res.locals.user as User) });
});

app.get('/api/users', auth, requirePermission('admin.users'), async (_req, res) => {
  const db = await readDb();
  res.json({ users: db.users.map(safeUser) });
});

app.post('/api/users', auth, requirePermission('admin.users'), async (req, res) => {
  const { username, displayName, password, permissions: inputPermissions, enabled } = req.body as {
    username?: string;
    displayName?: string;
    password?: string;
    permissions?: Permission[];
    enabled?: boolean;
  };
  if (!username || !password) return res.status(400).json({ message: '账号和密码不能为空' });
  const db = await readDb();
  if (db.users.some((user) => user.username === username)) {
    return res.status(409).json({ message: '账号已存在' });
  }
  const user: User = {
    id: uuid(),
    username,
    displayName: displayName || username,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'user',
    permissions: inputPermissions?.length ? inputPermissions : ['portal.download'],
    enabled: enabled ?? true,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeDb(db);
  res.status(201).json({ user: safeUser(user) });
});

app.put('/api/users/:id', auth, requirePermission('admin.users'), async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const { displayName, password, permissions: inputPermissions, enabled } = req.body as {
    displayName?: string;
    password?: string;
    permissions?: Permission[];
    enabled?: boolean;
  };
  user.displayName = displayName ?? user.displayName;
  user.permissions = inputPermissions ?? user.permissions;
  user.enabled = enabled ?? user.enabled;
  if (password) user.passwordHash = await bcrypt.hash(password, 10);
  await writeDb(db);
  res.json({ user: safeUser(user) });
});

app.delete('/api/users/:id', auth, requirePermission('admin.users'), async (req, res) => {
  if ((res.locals.user as User).id === req.params.id) {
    return res.status(400).json({ message: '不能删除当前登录用户' });
  }
  const db = await readDb();
  db.users = db.users.filter((user) => user.id !== req.params.id);
  await writeDb(db);
  res.status(204).send();
});

app.get('/api/packages', auth, requirePermission('admin.software'), async (_req, res) => {
  const db = await readDb();
  res.json({ packages: db.packages });
});

app.post('/api/packages', auth, requirePermission('admin.software'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传 zip 文件' });
  const { name, description, version, channel, published } = req.body as Record<string, string>;
  if (!name || !version || !channel) return res.status(400).json({ message: '名称、版本、类型不能为空' });
  const db = await readDb();
  const record: SoftwarePackage = {
    id: uuid(),
    name,
    description: description || '',
    version,
    channel: channel as VersionChannel,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    createdAt: new Date().toISOString(),
    published: published !== 'false',
  };
  db.packages.push(record);
  await writeDb(db);
  res.status(201).json({ package: record });
});

app.put('/api/packages/:id', auth, requirePermission('admin.software'), async (req, res) => {
  const db = await readDb();
  const record = db.packages.find((item) => item.id === req.params.id);
  if (!record) return res.status(404).json({ message: '安装包不存在' });
  const { name, description, version, channel, published } = req.body as Partial<SoftwarePackage>;
  record.name = name ?? record.name;
  record.description = description ?? record.description;
  record.version = version ?? record.version;
  record.channel = channel ?? record.channel;
  record.published = published ?? record.published;
  await writeDb(db);
  res.json({ package: record });
});

app.delete('/api/packages/:id', auth, requirePermission('admin.software'), async (req, res) => {
  const db = await readDb();
  const record = db.packages.find((item) => item.id === req.params.id);
  db.packages = db.packages.filter((item) => item.id !== req.params.id);
  await writeDb(db);
  if (record) await fs.rm(path.join(uploadsDir, record.fileName), { force: true });
  res.status(204).send();
});

app.get('/api/portal/packages', auth, requirePermission('portal.download'), async (_req, res) => {
  const db = await readDb();
  res.json({ packages: db.packages.filter((item) => item.published) });
});

app.get('/api/packages/:id/download', auth, requirePermission('portal.download'), async (req, res) => {
  const db = await readDb();
  const record = db.packages.find((item) => item.id === req.params.id && item.published);
  if (!record) return res.status(404).json({ message: '文件不存在或未发布' });
  res.download(path.join(uploadsDir, record.fileName), record.originalName);
});

if (existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(webDistDir, 'index.html'));
  });
}

app.listen(port, async () => {
  await readDb();
  console.log(`PackHub running at http://0.0.0.0:${port}`);
});
