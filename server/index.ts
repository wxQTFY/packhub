import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
  category: string;
  tags: string[];
  releaseNotes: string;
  stable: boolean;
  archived: boolean;
  fileName: string;
  originalName: string;
  size: number;
  sha256: string;
  downloadCount: number;
  lastDownloadedAt: string | null;
  createdAt: string;
  published: boolean;
}

interface JsonDatabase {
  users: User[];
  packages: Array<
    Omit<
      SoftwarePackage,
      'sha256' | 'downloadCount' | 'lastDownloadedAt' | 'category' | 'tags' | 'releaseNotes' | 'stable' | 'archived'
    > &
      Partial<SoftwarePackage>
  >;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const logsDir = path.join(rootDir, 'logs');
const webDistDir = path.join(rootDir, 'dist');
const sqlitePath = path.join(dataDir, 'packhub.sqlite');
const legacyJsonPath = path.join(dataDir, 'db.json');
const jwtSecret = process.env.JWT_SECRET || 'packhub-dev-secret';
const port = Number(process.env.PORT || 3001);
const maxUploadSize = Number(process.env.MAX_UPLOAD_MB || 1024) * 1024 * 1024;
const permissions: Permission[] = ['portal.download', 'admin.users', 'admin.software'];
const allowedChannels: VersionChannel[] = ['release', 'beta', 'history'];

let db: DatabaseSync;

function ensureStorage() {
  for (const dir of [dataDir, uploadsDir, logsDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

async function appendLog(fileName: string, message: string) {
  ensureStorage();
  const line = `${new Date().toISOString()} ${message}${os.EOL}`;
  await fs.appendFile(path.join(logsDir, fileName), line, 'utf-8');
}

function logInfo(message: string) {
  console.log(message);
  void appendLog('app.log', `[info] ${message}`);
}

function logWarn(message: string) {
  console.warn(message);
  void appendLog('app.log', `[warn] ${message}`);
}

async function ensureWritable(dir: string) {
  const probe = path.join(dir, `.write-test-${process.pid}`);
  await fs.writeFile(probe, 'ok', 'utf-8');
  await fs.rm(probe, { force: true });
}

async function runStartupChecks() {
  ensureStorage();
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('PackHub SQLite 版本需要 Node.js 24 或更高版本');
  }
  if (!process.env.JWT_SECRET) {
    logWarn('JWT_SECRET 未配置，当前使用开发默认密钥；生产部署请设置强随机 JWT_SECRET');
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT 配置无效：${process.env.PORT}`);
  }
  await Promise.all([ensureWritable(dataDir), ensureWritable(uploadsDir), ensureWritable(logsDir)]);
}

function openDatabase() {
  ensureStorage();
  db = new DatabaseSync(sqlitePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      version TEXT NOT NULL,
      channel TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '未分类',
      tags TEXT NOT NULL DEFAULT '[]',
      release_notes TEXT NOT NULL DEFAULT '',
      stable INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL DEFAULT '',
      download_count INTEGER NOT NULL DEFAULT 0,
      last_downloaded_at TEXT,
      created_at TEXT NOT NULL,
      published INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS download_logs (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      ip TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(package_id) REFERENCES packages(id) ON DELETE CASCADE
    );
  `);
  ensurePackageColumns();
}

function ensurePackageColumns() {
  const columns = new Set(
    db.prepare('PRAGMA table_info(packages)').all().map((row) => String((row as Record<string, unknown>).name)),
  );
  const additions: Array<[string, string]> = [
    ['category', "TEXT NOT NULL DEFAULT '未分类'"],
    ['tags', "TEXT NOT NULL DEFAULT '[]'"],
    ['release_notes', "TEXT NOT NULL DEFAULT ''"],
    ['stable', 'INTEGER NOT NULL DEFAULT 0'],
    ['archived', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [column, definition] of additions) {
    if (!columns.has(column)) db.exec(`ALTER TABLE packages ADD COLUMN ${column} ${definition}`);
  }
}

function runTransaction(action: () => void) {
  db.exec('BEGIN IMMEDIATE');
  try {
    action();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    passwordHash: String(row.password_hash),
    role: row.role as Role,
    permissions: JSON.parse(String(row.permissions)) as Permission[],
    enabled: Boolean(row.enabled),
    createdAt: String(row.created_at),
  };
}

function mapPackage(row: Record<string, unknown>): SoftwarePackage {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    version: String(row.version),
    channel: row.channel as VersionChannel,
    category: String(row.category || '未分类'),
    tags: JSON.parse(String(row.tags || '[]')) as string[],
    releaseNotes: String(row.release_notes || ''),
    stable: Boolean(row.stable),
    archived: Boolean(row.archived),
    fileName: String(row.file_name),
    originalName: String(row.original_name),
    size: Number(row.size),
    sha256: String(row.sha256 || ''),
    downloadCount: Number(row.download_count || 0),
    lastDownloadedAt: row.last_downloaded_at ? String(row.last_downloaded_at) : null,
    createdAt: String(row.created_at),
    published: Boolean(row.published),
  };
}

function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at ASC').all().map((row) => mapUser(row as Record<string, unknown>));
}

function findUserById(id: string) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ? mapUser(row as Record<string, unknown>) : null;
}

function findUserByUsername(username: string) {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  return row ? mapUser(row as Record<string, unknown>) : null;
}

function insertUser(user: User) {
  db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, role, permissions, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.displayName,
    user.passwordHash,
    user.role,
    JSON.stringify(user.permissions),
    user.enabled ? 1 : 0,
    user.createdAt,
  );
}

function updateUser(user: User) {
  db.prepare(`
    UPDATE users
    SET display_name = ?, password_hash = ?, permissions = ?, enabled = ?
    WHERE id = ?
  `).run(user.displayName, user.passwordHash, JSON.stringify(user.permissions), user.enabled ? 1 : 0, user.id);
}

function deleteUser(id: string) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function listPackages(includeUnpublished = true) {
  const sql = includeUnpublished
    ? 'SELECT * FROM packages ORDER BY stable DESC, archived ASC, created_at DESC'
    : 'SELECT * FROM packages WHERE published = 1 ORDER BY stable DESC, archived ASC, created_at DESC';
  return db.prepare(sql).all().map((row) => mapPackage(row as Record<string, unknown>));
}

function findPackageById(id: string) {
  const row = db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
  return row ? mapPackage(row as Record<string, unknown>) : null;
}

function packageVersionExists(name: string, version: string, exceptId = '') {
  const row = db.prepare(`
    SELECT id FROM packages
    WHERE lower(name) = lower(?) AND lower(version) = lower(?) AND id != ?
  `).get(name.trim(), version.trim(), exceptId);
  return Boolean(row);
}

function normalizeTags(input: unknown) {
  if (Array.isArray(input)) return input.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listCategories() {
  return db
    .prepare("SELECT DISTINCT category FROM packages WHERE category != '' ORDER BY category ASC")
    .all()
    .map((row) => String((row as Record<string, unknown>).category));
}

function dashboardSummary() {
  const packages = listPackages();
  const totalSize = packages.reduce((sum, item) => sum + item.size, 0);
  const totalDownloads = packages.reduce((sum, item) => sum + item.downloadCount, 0);
  const byChannel = Object.fromEntries(allowedChannels.map((channel) => [channel, packages.filter((item) => item.channel === channel).length]));
  const recent = packages.slice(0, 6);
  const popular = [...packages].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 6);
  return {
    totalPackages: packages.length,
    publishedPackages: packages.filter((item) => item.published).length,
    softwareCount: new Set(packages.map((item) => item.name)).size,
    categoryCount: listCategories().length,
    totalSize,
    totalDownloads,
    byChannel,
    recent,
    popular,
  };
}

function insertPackage(record: SoftwarePackage) {
  db.prepare(`
    INSERT INTO packages (
      id, name, description, version, channel, category, tags, release_notes, stable, archived,
      file_name, original_name, size,
      sha256, download_count, last_downloaded_at, created_at, published
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.name,
    record.description,
    record.version,
    record.channel,
    record.category,
    JSON.stringify(record.tags),
    record.releaseNotes,
    record.stable ? 1 : 0,
    record.archived ? 1 : 0,
    record.fileName,
    record.originalName,
    record.size,
    record.sha256,
    record.downloadCount,
    record.lastDownloadedAt,
    record.createdAt,
    record.published ? 1 : 0,
  );
}

function updatePackage(record: SoftwarePackage) {
  db.prepare(`
    UPDATE packages
    SET name = ?, description = ?, version = ?, channel = ?, category = ?, tags = ?,
        release_notes = ?, stable = ?, archived = ?, published = ?
    WHERE id = ?
  `).run(
    record.name,
    record.description,
    record.version,
    record.channel,
    record.category,
    JSON.stringify(record.tags),
    record.releaseNotes,
    record.stable ? 1 : 0,
    record.archived ? 1 : 0,
    record.published ? 1 : 0,
    record.id,
  );
}

function deletePackage(id: string) {
  db.prepare('DELETE FROM packages WHERE id = ?').run(id);
}

function rollbackPackage(record: SoftwarePackage) {
  runTransaction(() => {
    db.prepare(`
      UPDATE packages
      SET stable = 0,
          archived = CASE WHEN stable = 1 THEN 1 ELSE archived END,
          channel = CASE WHEN channel = 'release' THEN 'history' ELSE channel END
      WHERE lower(name) = lower(?) AND id != ?
    `).run(record.name, record.id);
    db.prepare(`
      UPDATE packages
      SET channel = 'release', stable = 1, archived = 0, published = 1
      WHERE id = ?
    `).run(record.id);
  });
}

function recordDownload(record: SoftwarePackage, user: User, req: express.Request) {
  const now = new Date().toISOString();
  runTransaction(() => {
    db.prepare('UPDATE packages SET download_count = download_count + 1, last_downloaded_at = ? WHERE id = ?').run(now, record.id);
    db.prepare(`
      INSERT INTO download_logs (id, package_id, user_id, username, ip, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), record.id, user.id, user.username, req.ip || '', req.get('user-agent') || '', now);
  });
  void appendLog('downloads.log', `${user.username} downloaded ${record.originalName} (${record.id}) from ${req.ip || '-'}`);
}

async function fileSha256(filePath: string) {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(filePath, 'r');
  try {
    for await (const chunk of handle.createReadStream()) {
      hash.update(chunk);
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

async function isZipFile(filePath: string) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4);
    const { bytesRead } = await handle.read(buffer, 0, 4, 0);
    if (bytesRead < 4) return false;
    return buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]);
  } finally {
    await handle.close();
  }
}

async function migrateLegacyJson() {
  const userCount = Number((db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count);
  const packageCount = Number((db.prepare('SELECT COUNT(*) AS count FROM packages').get() as { count: number }).count);
  if (userCount > 0 || packageCount > 0 || !existsSync(legacyJsonPath)) return;

  const legacy = JSON.parse(await fs.readFile(legacyJsonPath, 'utf-8')) as JsonDatabase;
  runTransaction(() => {
    for (const user of legacy.users || []) insertUser(user);
    for (const item of legacy.packages || []) {
      insertPackage({
        id: item.id,
        name: item.name,
        description: item.description,
        version: item.version,
        channel: item.channel,
        category: item.category || '未分类',
        tags: item.tags || [],
        releaseNotes: item.releaseNotes || item.description || '',
        stable: item.stable ?? item.channel === 'release',
        archived: item.archived ?? item.channel === 'history',
        fileName: item.fileName,
        originalName: item.originalName,
        size: item.size,
        sha256: item.sha256 || '',
        downloadCount: item.downloadCount || 0,
        lastDownloadedAt: item.lastDownloadedAt || null,
        createdAt: item.createdAt,
        published: item.published,
      });
    }
  });
  await fs.copyFile(legacyJsonPath, `${legacyJsonPath}.migrated-${Date.now()}.bak`);
  logInfo(`已从 ${legacyJsonPath} 迁移数据到 SQLite`);
}

async function ensureDefaultAdmin() {
  const count = Number((db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count);
  if (count > 0) return;
  insertUser({
    id: uuid(),
    username: 'admin',
    displayName: '系统管理员',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'admin',
    permissions,
    enabled: true,
    createdAt: new Date().toISOString(),
  });
}

async function backfillPackageHashes() {
  for (const item of listPackages()) {
    if (item.sha256) continue;
    const filePath = path.join(uploadsDir, item.fileName);
    if (!existsSync(filePath)) continue;
    const sha256 = await fileSha256(filePath);
    db.prepare('UPDATE packages SET sha256 = ? WHERE id = ?').run(sha256, item.id);
  }
}

function ensureStablePackages() {
  const packages = listPackages();
  for (const name of new Set(packages.map((item) => item.name.toLowerCase()))) {
    const versions = packages.filter((item) => item.name.toLowerCase() === name);
    if (versions.some((item) => item.stable)) continue;
    const latestRelease = versions.find((item) => item.channel === 'release' && !item.archived);
    if (latestRelease) db.prepare('UPDATE packages SET stable = 1 WHERE id = ?').run(latestRelease.id);
  }
}

async function cleanupOrphanUploads() {
  const knownFiles = new Set(listPackages().map((item) => item.fileName));
  const files = await fs.readdir(uploadsDir);
  for (const file of files) {
    if (file === '.gitkeep' || knownFiles.has(file)) continue;
    await fs.rm(path.join(uploadsDir, file), { force: true });
    logInfo(`已清理无效上传文件：${file}`);
  }
}

async function initializeDatabase() {
  openDatabase();
  await migrateLegacyJson();
  await ensureDefaultAdmin();
  ensureStablePackages();
  await backfillPackageHashes();
  await cleanupOrphanUploads();
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
    const user = findUserById(payload.userId);
    if (!user || !user.enabled) return res.status(401).json({ message: '登录已失效' });
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

function paramId(req: express.Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
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
  limits: { fileSize: maxUploadSize },
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    storage: 'sqlite',
    uptime: process.uptime(),
    database: sqlitePath,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const user = username ? findUserByUsername(username) : null;
  if (!user || !user.enabled || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ message: '账号或密码错误' });
  }
  res.json({ token: createToken(user), user: safeUser(user) });
});

app.get('/api/auth/me', auth, (_req, res) => {
  res.json({ user: safeUser(res.locals.user as User) });
});

app.get('/api/users', auth, requirePermission('admin.users'), (_req, res) => {
  res.json({ users: listUsers().map(safeUser) });
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
  if (findUserByUsername(username)) return res.status(409).json({ message: '账号已存在' });

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
  insertUser(user);
  res.status(201).json({ user: safeUser(user) });
});

app.put('/api/users/:id', auth, requirePermission('admin.users'), async (req, res) => {
  const id = paramId(req);
  const user = findUserById(id);
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
  updateUser(user);
  res.json({ user: safeUser(user) });
});

app.delete('/api/users/:id', auth, requirePermission('admin.users'), (req, res) => {
  const id = paramId(req);
  if ((res.locals.user as User).id === id) {
    return res.status(400).json({ message: '不能删除当前登录用户' });
  }
  deleteUser(id);
  res.status(204).send();
});

app.get('/api/packages', auth, requirePermission('admin.software'), (_req, res) => {
  res.json({ packages: listPackages() });
});

app.get('/api/dashboard', auth, requirePermission('admin.software'), (_req, res) => {
  res.json(dashboardSummary());
});

app.get('/api/categories', auth, (_req, res) => {
  res.json({ categories: listCategories() });
});

app.get('/api/package-details/:id', auth, (req, res) => {
  const record = findPackageById(paramId(req));
  const user = res.locals.user as User;
  const canManage = user.permissions.includes('admin.software');
  if (!record || (!record.published && !canManage)) return res.status(404).json({ message: '版本不存在或未发布' });
  res.json({ package: record });
});

app.post('/api/packages', auth, requirePermission('admin.software'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传 zip 文件' });
  const filePath = path.join(uploadsDir, req.file.filename);
  try {
    const { name, description, version, channel, category, tags, releaseNotes, stable, archived, published } = req.body as Record<string, string>;
    if (!name || !version || !channel) throw new Error('名称、版本、类型不能为空');
    if (!allowedChannels.includes(channel as VersionChannel)) throw new Error('版本类型无效');
    if (packageVersionExists(name, version)) {
      await fs.rm(filePath, { force: true });
      return res.status(409).json({ message: '同一软件下版本号不能重复' });
    }
    if (!(await isZipFile(filePath))) throw new Error('文件内容不是有效 zip 安装包');

    const record: SoftwarePackage = {
      id: uuid(),
      name: name.trim(),
      description: description || '',
      version: version.trim(),
      channel: channel as VersionChannel,
      category: category?.trim() || '未分类',
      tags: normalizeTags(tags),
      releaseNotes: releaseNotes || '',
      stable: stable === 'true',
      archived: archived === 'true' || channel === 'history',
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      sha256: await fileSha256(filePath),
      downloadCount: 0,
      lastDownloadedAt: null,
      createdAt: new Date().toISOString(),
      published: published !== 'false',
    };
    insertPackage(record);
    if (record.stable) rollbackPackage(record);
    res.status(201).json({ package: record });
  } catch (error) {
    await fs.rm(filePath, { force: true });
    throw error;
  }
});

app.put('/api/packages/:id', auth, requirePermission('admin.software'), (req, res) => {
  const record = findPackageById(paramId(req));
  if (!record) return res.status(404).json({ message: '安装包不存在' });
  const { name, description, version, channel, category, tags, releaseNotes, stable, archived, published } = req.body as Partial<SoftwarePackage>;
  if (channel && !allowedChannels.includes(channel)) return res.status(400).json({ message: '版本类型无效' });
  const nextName = name?.trim() || record.name;
  const nextVersion = version?.trim() || record.version;
  if (packageVersionExists(nextName, nextVersion, record.id)) {
    return res.status(409).json({ message: '同一软件下版本号不能重复' });
  }
  record.name = nextName;
  record.description = description ?? record.description;
  record.version = nextVersion;
  record.channel = channel ?? record.channel;
  record.category = category?.trim() || record.category;
  record.tags = tags ? normalizeTags(tags) : record.tags;
  record.releaseNotes = releaseNotes ?? record.releaseNotes;
  record.stable = stable ?? record.stable;
  record.archived = archived ?? record.archived;
  record.published = published ?? record.published;
  updatePackage(record);
  if (record.stable) rollbackPackage(record);
  res.json({ package: record });
});

app.post('/api/packages/:id/rollback', auth, requirePermission('admin.software'), (req, res) => {
  const record = findPackageById(paramId(req));
  if (!record) return res.status(404).json({ message: '安装包不存在' });
  rollbackPackage(record);
  res.json({ package: findPackageById(record.id) });
});

app.delete('/api/packages/:id', auth, requirePermission('admin.software'), async (req, res) => {
  const id = paramId(req);
  const record = findPackageById(id);
  deletePackage(id);
  if (record) await fs.rm(path.join(uploadsDir, record.fileName), { force: true });
  res.status(204).send();
});

app.get('/api/portal/packages', auth, requirePermission('portal.download'), (_req, res) => {
  res.json({ packages: listPackages(false) });
});

app.get('/api/portal/packages/:id', auth, requirePermission('portal.download'), (req, res) => {
  const record = findPackageById(paramId(req));
  if (!record || !record.published) return res.status(404).json({ message: '版本不存在或未发布' });
  res.json({ package: record });
});

app.get('/api/packages/:id/download', auth, requirePermission('portal.download'), async (req, res) => {
  const record = findPackageById(paramId(req));
  if (!record || !record.published) return res.status(404).json({ message: '文件不存在或未发布' });
  const filePath = path.join(uploadsDir, record.fileName);
  if (!existsSync(filePath)) return res.status(404).json({ message: '文件不存在' });

  const stat = await fs.stat(filePath);
  const range = req.headers.range;
  const encodedName = encodeURIComponent(record.originalName);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
  res.setHeader('X-Content-SHA256', record.sha256);

  recordDownload(record, res.locals.user as User, req);

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return res.status(416).send();
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) return res.status(416).send();
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    return createReadStream(filePath, { start, end }).pipe(res);
  }

  res.setHeader('Content-Length', stat.size);
  return createReadStream(filePath).pipe(res);
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void appendLog('app.log', `[error] ${error.stack || error.message}`);
  const message = error.message.includes('File too large') ? `文件不能超过 ${Math.floor(maxUploadSize / 1024 / 1024)} MB` : error.message;
  res.status(400).json({ message: message || '请求失败' });
});

if (existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(webDistDir, 'index.html'));
  });
}

async function start() {
  await runStartupChecks();
  await initializeDatabase();
  app.listen(port, () => {
    logInfo(`PackHub running at http://0.0.0.0:${port}`);
    logInfo(`SQLite database: ${sqlitePath}`);
  });
}

void start().catch((error) => {
  console.error(error);
  void appendLog('app.log', `[fatal] ${error.stack || error.message}`);
  process.exit(1);
});
