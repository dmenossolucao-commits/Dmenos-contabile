import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

const app = express();
app.use(express.json());

// Load Firebase configuration
const configPath = path.resolve('firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Error reading firebase-applet-config.json:', e);
  }
}

// Initialize Firebase for server persistence
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

// Local backup file for offline / cold-start fallback
const dataDir = path.resolve('data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const localStorePath = path.join(dataDir, 'auth_users.json');

interface StoredUser {
  id: string;
  username: string; // stored lowercase
  displayName: string;
  salt: string;
  hash: string;
  role: 'admin' | 'employee';
  status: 'active' | 'blocked';
  permissions: {
    canViewDashboard: boolean;
    canManageClosures: boolean;
    canManageExpenses: boolean;
    canManageVales: boolean;
    canManageBankAccounts: boolean;
    canViewHistory: boolean;
    canManageCalendar: boolean;
    canViewReports: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: number; // timestamp
}

// In-memory cache synced with Firestore / local disk
let usersCache = new Map<string, StoredUser>();
let sessionsCache = new Map<string, StoredSession>();

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { salt: actualSalt, hash };
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Sync Cache from Firestore and local backup
async function loadAllUsers() {
  try {
    // 1. Try local backup file
    if (fs.existsSync(localStorePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(localStorePath, 'utf8'));
        if (Array.isArray(raw)) {
          for (const u of raw) {
            usersCache.set(u.id, u);
          }
        }
      } catch (err) {
        console.error('Error reading local auth store:', err);
      }
    }

    // 2. Try Firestore app_users and system_users
    try {
      const snapApp = await getDocs(collection(db, 'app_users'));
      snapApp.forEach((d) => {
        const u = d.data() as StoredUser;
        usersCache.set(u.id, u);
      });
      const snap = await getDocs(collection(db, 'system_users'));
      snap.forEach((d) => {
        const u = d.data() as StoredUser;
        usersCache.set(u.id, u);
      });
    } catch (e) {
      console.warn('Firestore load warning:', (e as Error).message);
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

// Persist user to Firestore and local backup
async function saveUser(user: StoredUser) {
  usersCache.set(user.id, user);

  // Local file sync
  try {
    const list = Array.from(usersCache.values());
    fs.writeFileSync(localStorePath, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local auth store:', e);
  }

  // Firestore sync (both collections for compatibility)
  try {
    await setDoc(doc(db, 'app_users', user.id), user);
    await setDoc(doc(db, 'system_users', user.id), user);
  } catch (e) {
    console.warn('Error saving user to Firestore:', (e as Error).message);
  }
}

// Remove user
async function deleteUser(userId: string) {
  usersCache.delete(userId);
  try {
    const list = Array.from(usersCache.values());
    fs.writeFileSync(localStorePath, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Error updating local auth store:', e);
  }
  try {
    await deleteDoc(doc(db, 'system_users', userId));
  } catch (e) {
    console.warn('Error deleting user from Firestore:', (e as Error).message);
  }
}

// Session helper
function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: StoredSession = {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  sessionsCache.set(token, session);
  return token;
}

function sanitizeUser(u: StoredUser) {
  const { salt, hash, ...clean } = u;
  return clean;
}

// Authentication Middleware
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão não autenticada. Faça login.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const session = sessionsCache.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessionsCache.delete(token);
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return;
  }

  const user = usersCache.get(session.userId);
  if (!user || user.status === 'blocked') {
    res.status(403).json({ error: 'Usuário bloqueado ou inexistente.' });
    return;
  }

  (req as any).user = user;
  (req as any).token = token;
  next();
}

// Admin only middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as StoredUser;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }
  next();
}

// Initialize users cache on boot
await loadAllUsers();

// --- API ENDPOINTS ---

// 1. GET /api/auth/status
app.get('/api/auth/status', async (req: Request, res: Response) => {
  try {
    const snapApp = await getDocs(collection(db, 'app_users'));
    let hasAdmin = false;
    snapApp.forEach((d) => {
      const u = d.data() as StoredUser;
      usersCache.set(u.id, u);
      if (u.role === 'admin' && u.status === 'active') {
        hasAdmin = true;
      }
    });
    res.json({
      needsInitialSetup: !hasAdmin,
    });
  } catch (err) {
    const adminExists = Array.from(usersCache.values()).some((u) => u.role === 'admin' && u.status === 'active');
    res.json({
      needsInitialSetup: !adminExists,
      error: (err as Error).message,
    });
  }
});

// 2. POST /api/auth/setup-admin
app.post('/api/auth/setup-admin', async (req: Request, res: Response) => {
  const adminExists = Array.from(usersCache.values()).some((u) => u.role === 'admin');
  if (adminExists) {
    res.status(403).json({
      error: 'O administrador inicial já foi configurado no sistema. Acesso negado.',
    });
    return;
  }

  const { username, password, displayName } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();
  const id = 'usr_' + Date.now();
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();

  const adminUser: StoredUser = {
    id,
    username: cleanUsername,
    displayName: (displayName && displayName.trim()) || 'Administrador',
    salt,
    hash,
    role: 'admin',
    status: 'active',
    permissions: {
      canViewDashboard: true,
      canManageClosures: true,
      canManageExpenses: true,
      canManageVales: true,
      canManageBankAccounts: true,
      canViewHistory: true,
      canManageCalendar: true,
      canViewReports: true,
    },
    createdAt: now,
    updatedAt: now,
  };

  await saveUser(adminUser);
  const token = createSession(id);

  res.json({
    message: 'Administrador configurado com sucesso!',
    token,
    user: sanitizeUser(adminUser),
  });
});

// 3. POST /api/auth/login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Informe nome de usuário e senha.' });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();
  const user = Array.from(usersCache.values()).find((u) => u.username === cleanUsername);

  if (!user) {
    res.status(401).json({ error: 'Nome de usuário ou senha incorretos.' });
    return;
  }

  if (user.status === 'blocked') {
    res.status(403).json({
      error: 'Este usuário está bloqueado pelo administrador. Entre em contato com a gerência.',
    });
    return;
  }

  const isValid = verifyPassword(password, user.salt, user.hash);
  if (!isValid) {
    res.status(401).json({ error: 'Nome de usuário ou senha incorretos.' });
    return;
  }

  const token = createSession(user.id);
  res.json({
    token,
    user: sanitizeUser(user),
  });
});

// 4. GET /api/auth/me
app.get('/api/auth/me', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  res.json({
    user: sanitizeUser(user),
  });
});

// 5. POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    sessionsCache.delete(token);
  }
  res.json({ success: true });
});

// 6. GET /api/users (Admin only)
app.get('/api/users', authenticate, requireAdmin, (req: Request, res: Response) => {
  const list = Array.from(usersCache.values()).map(sanitizeUser);
  res.json({ users: list });
});

// 7. POST /api/users (Admin only - create user)
app.post('/api/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const { username, displayName, initialPassword, role, permissions } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();
  const exists = Array.from(usersCache.values()).some((u) => u.username === cleanUsername);
  if (exists) {
    res.status(400).json({ error: 'Este nome de usuário já está em uso. Escolha outro.' });
    return;
  }

  if (!initialPassword || typeof initialPassword !== 'string' || initialPassword.length < 6) {
    res.status(400).json({ error: 'A senha inicial deve ter pelo menos 6 caracteres.' });
    return;
  }

  const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const { salt, hash } = hashPassword(initialPassword);
  const now = new Date().toISOString();

  const userRole = role === 'admin' ? 'admin' : 'employee';
  const defaultPerms = userRole === 'admin'
    ? {
        canViewDashboard: true,
        canManageClosures: true,
        canManageExpenses: true,
        canManageVales: true,
        canManageBankAccounts: true,
        canViewHistory: true,
        canManageCalendar: true,
        canViewReports: true,
      }
    : {
        canViewDashboard: true,
        canManageClosures: permissions?.canManageClosures ?? true,
        canManageExpenses: permissions?.canManageExpenses ?? true,
        canManageVales: permissions?.canManageVales ?? true,
        canManageBankAccounts: permissions?.canManageBankAccounts ?? false,
        canViewHistory: permissions?.canViewHistory ?? false,
        canManageCalendar: permissions?.canManageCalendar ?? true,
        canViewReports: permissions?.canViewReports ?? false,
      };

  const newUser: StoredUser = {
    id,
    username: cleanUsername,
    displayName: (displayName && displayName.trim()) || cleanUsername,
    salt,
    hash,
    role: userRole,
    status: 'active',
    permissions: defaultPerms,
    createdAt: now,
    updatedAt: now,
  };

  await saveUser(newUser);

  res.json({
    message: 'Usuário cadastrado com sucesso!',
    user: sanitizeUser(newUser),
  });
});

// 8. PUT /api/users/:id (Admin only - update user / reset password / toggle status / update permissions)
app.put('/api/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const currentUser = (req as any).user as StoredUser;
  const user = usersCache.get(targetId);

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  const { displayName, role, status, permissions, newPassword } = req.body;

  // Protect admin from blocking or demoting their own current account
  if (user.id === currentUser.id) {
    if (status === 'blocked') {
      res.status(400).json({ error: 'Você não pode bloquear sua própria conta de administrador.' });
      return;
    }
    if (role && role !== 'admin') {
      res.status(400).json({ error: 'Você não pode remover seu próprio perfil de administrador.' });
      return;
    }
  }

  if (displayName) user.displayName = displayName.trim();
  if (role && (role === 'admin' || role === 'employee')) user.role = role;
  if (status && (status === 'active' || status === 'blocked')) user.status = status;

  if (permissions && typeof permissions === 'object') {
    user.permissions = {
      ...user.permissions,
      ...permissions,
    };
  }

  if (newPassword && typeof newPassword === 'string') {
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    const { salt, hash } = hashPassword(newPassword);
    user.salt = salt;
    user.hash = hash;

    // Invalidate existing sessions for this user (except current if changing own password)
    for (const [token, sess] of sessionsCache.entries()) {
      if (sess.userId === user.id && token !== (req as any).token) {
        sessionsCache.delete(token);
      }
    }
  }

  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  res.json({
    message: 'Usuário atualizado com sucesso!',
    user: sanitizeUser(user),
  });
});

// 9. DELETE /api/users/:id (Admin only)
app.delete('/api/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const currentUser = (req as any).user as StoredUser;

  if (targetId === currentUser.id) {
    res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
    return;
  }

  const user = usersCache.get(targetId);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  await deleteUser(targetId);

  // Invalidate any sessions
  for (const [token, sess] of sessionsCache.entries()) {
    if (sess.userId === targetId) {
      sessionsCache.delete(token);
    }
  }

  res.json({ message: 'Usuário excluído com sucesso.' });
});

// Frontend Vite Integration (dev / prod)
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve('dist');
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dmenos Contro servidor ativo em http://0.0.0.0:${PORT}`);
});
