import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, UserRole, UserPermissions, getDefaultPermissions } from '../types';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';

export interface StoredUserDoc {
  id: string;
  username: string; // stored lowercase
  displayName: string;
  salt: string;
  hash: string;
  role: UserRole;
  status: 'active' | 'blocked';
  permissions: UserPermissions;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  permissions: UserPermissions;
  loading: boolean;
  needsInitialSetup: boolean;
  connectionError: string | null;
  isVercelOrClientMode: boolean;
  login: (username: string, pass: string) => Promise<void>;
  setupInitialAdmin: (username: string, pass: string, name: string) => Promise<void>;
  resetAdminPassword: (newUsername: string, newPass: string) => Promise<void>;
  retryConnection: () => Promise<void>;
  signOutApp: () => Promise<void>;
  // Admin user management functions
  systemUsers: UserProfile[];
  refreshUsers: () => Promise<void>;
  createUser: (data: {
    username: string;
    displayName: string;
    initialPassword: string;
    role: UserRole;
    permissions: UserPermissions;
  }) => Promise<void>;
  updateUser: (
    id: string,
    data: {
      displayName?: string;
      role?: UserRole;
      status?: 'active' | 'blocked';
      permissions?: Partial<UserPermissions>;
      newPassword?: string;
    }
  ) => Promise<void>;
  deleteUserAccount: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'dmenos_auth_token';
const SESSION_USER_KEY = 'dmenos_session_user';

export function safeGetStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Storage remove failed:', e);
  }
}

// Web Crypto PBKDF2 hasher - 100% compatible with Node crypto.pbkdf2Sync(..., 100000, 64, 'sha512')
export async function hashPasswordBrowser(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-512',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-512', length: 512 },
    true,
    ['sign']
  );
  const exported = await crypto.subtle.exportKey('raw', derivedKey);
  return Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [, setToken] = useState<string | null>(() => safeGetStorage(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isVercelOrClientMode, setIsVercelOrClientMode] = useState(false);
  const [systemUsers, setSystemUsers] = useState<UserProfile[]>([]);

  // Check system status & verify existing session
  const checkAuth = useCallback(async () => {
    setLoading(true);
    setConnectionError(null);

    try {
      // 1. Detect if local Node server API is responding
      let isServerActive = false;
      try {
        const statusRes = await fetch('/api/auth/status');
        const cType = statusRes.headers.get('content-type') || '';
        if (statusRes.ok && cType.includes('application/json')) {
          isServerActive = true;
        }
      } catch (err) {
        isServerActive = false;
      }
      setIsVercelOrClientMode(!isServerActive);

      // 2. Query Firestore as the single authoritative source of truth for both AI Studio and Vercel
      let snap;
      try {
        const fetchPromise = getDocs(collection(db, 'app_users'));
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tempo limite de conexão esgotado (10s).')), 10000)
        );
        snap = (await Promise.race([fetchPromise, timeoutPromise])) as any;
      } catch (fsErr: any) {
        console.error('CRITICAL: Firestore error querying app_users:', fsErr);
        // DO NOT assume database is empty on connection/network/permission error!
        setConnectionError(
          'Não foi possível conectar ao banco de dados no momento (' +
            (fsErr?.message || 'Falha de rede') +
            '). Verifique sua conexão e tente novamente.'
        );
        setNeedsInitialSetup(false);
        setLoading(false);
        return;
      }

      const usersList: StoredUserDoc[] = [];
      snap.forEach((d: any) => usersList.push(d.data() as StoredUserDoc));

      const hasActiveAdmin = usersList.some((u) => u.role === 'admin' && u.status === 'active');

      if (!hasActiveAdmin) {
        // Only if Firestore successfully responded AND there is no admin in app_users
        setNeedsInitialSetup(true);
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      // Admin exists in Firestore! Never ask for initial setup.
      setNeedsInitialSetup(false);

      // 3. Verify saved session in storage
      const savedSession = safeGetStorage(SESSION_USER_KEY);
      if (savedSession) {
        try {
          const sessionUser = JSON.parse(savedSession) as UserProfile;
          const freshUserDoc = usersList.find((u) => u.id === sessionUser.id);

          if (freshUserDoc && freshUserDoc.status === 'active') {
            const profile: UserProfile = {
              id: freshUserDoc.id,
              username: freshUserDoc.username,
              displayName: freshUserDoc.displayName,
              role: freshUserDoc.role,
              status: freshUserDoc.status,
              permissions: freshUserDoc.permissions,
              createdAt: freshUserDoc.createdAt,
              updatedAt: freshUserDoc.updatedAt,
            };
            setCurrentUser(profile);
          } else {
            // User was removed, blocked, or altered
            safeRemoveStorage(SESSION_USER_KEY);
            safeRemoveStorage(TOKEN_KEY);
            setCurrentUser(null);
          }
        } catch (err) {
          safeRemoveStorage(SESSION_USER_KEY);
          setCurrentUser(null);
        }
      } else {
        // Also check server token if available
        const savedToken = safeGetStorage(TOKEN_KEY);
        if (savedToken && isServerActive) {
          try {
            const meRes = await fetch('/api/auth/me', {
              headers: { Authorization: `Bearer ${savedToken}` },
            });
            const cType = meRes.headers.get('content-type') || '';
            if (meRes.ok && cType.includes('application/json')) {
              const meData = await meRes.json();
              setCurrentUser(meData.user);
              safeSetStorage(SESSION_USER_KEY, JSON.stringify(meData.user));
            }
          } catch (e) {
            console.warn('Server /me check failed:', e);
          }
        }
      }
    } catch (err: any) {
      console.error('Error during auth check:', err);
      setConnectionError('Erro inesperado ao verificar autenticação: ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load system users for Admin
  const refreshUsers = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'app_users'));
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const u = d.data() as StoredUserDoc;
        list.push({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          role: u.role,
          status: u.status,
          permissions: u.permissions,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        });
      });
      setSystemUsers(list);
    } catch (err) {
      console.warn('Failed to load users from Firestore:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      refreshUsers();
    } else {
      setSystemUsers([]);
    }
  }, [currentUser, refreshUsers]);

  // Setup initial admin (One-time only, persisted to Firestore shared database)
  const setupInitialAdmin = async (username: string, pass: string, name: string) => {
    setLoading(true);
    setConnectionError(null);
    const cleanUser = username.trim().toLowerCase();
    const cleanName = name.trim() || 'Administrador';
    const now = new Date().toISOString();

    try {
      // 1. Guard: Check directly in Firestore if an admin already exists
      const snap = await getDocs(collection(db, 'app_users'));
      const existingAdmin = snap.docs.some((d) => {
        const u = d.data() as StoredUserDoc;
        return u.role === 'admin' && u.status === 'active';
      });

      if (existingAdmin) {
        throw new Error(
          'O administrador principal já está configurado no sistema. Acesso negado para criação secundária.'
        );
      }

      // 2. Generate secure PBKDF2 hash (100,000 iterations, SHA-512)
      const salt = generateSalt();
      const hash = await hashPasswordBrowser(pass, salt);
      const adminId = `usr_admin_${cleanUser}_${Date.now()}`;

      const adminDoc: StoredUserDoc = {
        id: adminId,
        username: cleanUser,
        displayName: cleanName,
        salt,
        hash,
        role: 'admin',
        status: 'active',
        permissions: getDefaultPermissions('admin'),
        createdAt: now,
        updatedAt: now,
      };

      // 3. Save to Firestore shared database (both app_users and system_users)
      await setDoc(doc(db, 'app_users', adminId), adminDoc);
      try {
        await setDoc(doc(db, 'system_users', adminId), adminDoc);
      } catch (e) {
        // ignore secondary collection if not permitted
      }

      // 4. If Node dev server is active, also notify server
      try {
        await fetch('/api/auth/setup-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUser,
            password: pass,
            displayName: cleanName,
          }),
        });
      } catch (e) {
        // Dev server notification optional
      }

      const profile: UserProfile = {
        id: adminId,
        username: cleanUser,
        displayName: cleanName,
        role: 'admin',
        status: 'active',
        permissions: getDefaultPermissions('admin'),
        createdAt: now,
        updatedAt: now,
      };

      safeSetStorage(SESSION_USER_KEY, JSON.stringify(profile));
      setCurrentUser(profile);
      setNeedsInitialSetup(false);
    } finally {
      setLoading(false);
    }
  };

  // Login with username & password
  const login = async (username: string, pass: string) => {
    setLoading(true);
    setConnectionError(null);
    const cleanUser = username.trim().toLowerCase();

    try {
      // 1. Query Firestore app_users
      const snap = await getDocs(collection(db, 'app_users'));
      if (snap.empty) {
        setNeedsInitialSetup(true);
        throw new Error('Nenhum administrador cadastrado. Configure o administrador inicial.');
      }

      const usersList: StoredUserDoc[] = [];
      snap.forEach((d) => usersList.push(d.data() as StoredUserDoc));

      const foundDoc = usersList.find((u) => u.username.toLowerCase() === cleanUser);

      if (!foundDoc) {
        throw new Error('Usuário não encontrado. Verifique o nome de usuário digitado.');
      }

      if (foundDoc.status === 'blocked') {
        throw new Error('Este usuário foi desativado pelo administrador. Acesso bloqueado.');
      }

      // 2. Verify password hash using PBKDF2
      const computedHash = await hashPasswordBrowser(pass, foundDoc.salt);
      if (computedHash !== foundDoc.hash) {
        throw new Error('Senha incorreta. Tente novamente.');
      }

      // 3. Successful login
      const profile: UserProfile = {
        id: foundDoc.id,
        username: foundDoc.username,
        displayName: foundDoc.displayName,
        role: foundDoc.role,
        status: foundDoc.status,
        permissions: foundDoc.permissions,
        createdAt: foundDoc.createdAt,
        updatedAt: foundDoc.updatedAt,
      };

      safeSetStorage(SESSION_USER_KEY, JSON.stringify(profile));
      setCurrentUser(profile);
      setNeedsInitialSetup(false);

      // Dev server sync (optional)
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: pass }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            safeSetStorage(TOKEN_KEY, data.token);
            setToken(data.token);
          }
        }
      } catch (e) {
        // Server login optional on static Vercel
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset or create Admin password (recovery mode)
  const resetAdminPassword = async (newUsername: string, newPass: string) => {
    setLoading(true);
    setConnectionError(null);
    const cleanUser = newUsername.trim().toLowerCase() || 'admin';
    const now = new Date().toISOString();

    try {
      const salt = generateSalt();
      const hash = await hashPasswordBrowser(newPass, salt);

      // Check for existing admin doc in app_users
      const snap = await getDocs(collection(db, 'app_users'));
      const usersList: StoredUserDoc[] = [];
      snap.forEach((d) => usersList.push(d.data() as StoredUserDoc));

      const existingDoc = usersList.find((u) => u.role === 'admin') || null;
      const adminId = existingDoc ? existingDoc.id : `usr_admin_${Date.now()}`;

      const adminDoc: StoredUserDoc = {
        id: adminId,
        username: cleanUser,
        displayName: existingDoc?.displayName || 'Administrador Principal',
        salt,
        hash,
        role: 'admin',
        status: 'active',
        permissions: getDefaultPermissions('admin'),
        createdAt: existingDoc?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'app_users', adminId), adminDoc);
      try {
        await setDoc(doc(db, 'system_users', adminId), adminDoc);
      } catch (e) {
        // secondary
      }

      const profile: UserProfile = {
        id: adminId,
        username: cleanUser,
        displayName: adminDoc.displayName,
        role: 'admin',
        status: 'active',
        permissions: getDefaultPermissions('admin'),
        createdAt: adminDoc.createdAt,
        updatedAt: now,
      };

      safeSetStorage(SESSION_USER_KEY, JSON.stringify(profile));
      setCurrentUser(profile);
      setNeedsInitialSetup(false);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const signOutApp = async () => {
    const currentToken = safeGetStorage(TOKEN_KEY);
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch (e) {
        // ignore
      }
    }
    safeRemoveStorage(TOKEN_KEY);
    safeRemoveStorage(SESSION_USER_KEY);
    setCurrentUser(null);
    setToken(null);
    setSystemUsers([]);
  };

  // Create user (Admin only)
  const createUser = async (userData: {
    username: string;
    displayName: string;
    initialPassword: string;
    role: UserRole;
    permissions: UserPermissions;
  }) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Apenas administradores podem cadastrar novos usuários.');
    }

    const cleanUser = userData.username.trim().toLowerCase();
    const now = new Date().toISOString();

    // Check if user already exists
    const snap = await getDocs(
      query(collection(db, 'app_users'), where('username', '==', cleanUser))
    );
    if (!snap.empty) {
      throw new Error(`O nome de usuário "${cleanUser}" já está em uso.`);
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const salt = generateSalt();
    const hash = await hashPasswordBrowser(userData.initialPassword, salt);

    const newUserDoc: StoredUserDoc = {
      id,
      username: cleanUser,
      displayName: userData.displayName.trim(),
      salt,
      hash,
      role: userData.role,
      status: 'active',
      permissions: userData.role === 'admin' ? getDefaultPermissions('admin') : userData.permissions,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'app_users', id), newUserDoc);
    try {
      await setDoc(doc(db, 'system_users', id), newUserDoc);
    } catch (e) {
      // secondary
    }

    // Server dev sync (optional)
    try {
      const currentToken = safeGetStorage(TOKEN_KEY);
      if (currentToken) {
        await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify(userData),
        });
      }
    } catch (e) {
      // ignore
    }

    await refreshUsers();
  };

  // Update user (Admin only)
  const updateUser = async (
    id: string,
    updateData: {
      displayName?: string;
      role?: UserRole;
      status?: 'active' | 'blocked';
      permissions?: Partial<UserPermissions>;
      newPassword?: string;
    }
  ) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Apenas administradores podem editar usuários.');
    }

    const now = new Date().toISOString();
    const docRef = doc(db, 'app_users', id);

    const patch: Partial<StoredUserDoc> = {
      updatedAt: now,
    };

    if (updateData.displayName) patch.displayName = updateData.displayName.trim();
    if (updateData.role) patch.role = updateData.role;
    if (updateData.status) patch.status = updateData.status;
    if (updateData.permissions) {
      patch.permissions = {
        ...getDefaultPermissions(updateData.role || 'employee'),
        ...updateData.permissions,
      };
    }
    if (updateData.newPassword) {
      const salt = generateSalt();
      const hash = await hashPasswordBrowser(updateData.newPassword, salt);
      patch.salt = salt;
      patch.hash = hash;
    }

    await updateDoc(docRef, patch as any);
    try {
      await updateDoc(doc(db, 'system_users', id), patch as any);
    } catch (e) {
      // secondary
    }

    // If updating currently logged in user
    if (currentUser && currentUser.id === id) {
      const updatedProfile: UserProfile = {
        ...currentUser,
        ...(updateData.displayName ? { displayName: updateData.displayName.trim() } : {}),
        ...(updateData.role ? { role: updateData.role } : {}),
        ...(updateData.status ? { status: updateData.status } : {}),
        ...(updateData.permissions ? { permissions: patch.permissions! } : {}),
        updatedAt: now,
      };
      setCurrentUser(updatedProfile);
      safeSetStorage(SESSION_USER_KEY, JSON.stringify(updatedProfile));
    }

    await refreshUsers();
  };

  // Delete user account (Admin only)
  const deleteUserAccount = async (id: string) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('Apenas administradores podem excluir usuários.');
    }
    if (currentUser?.id === id) {
      throw new Error('Você não pode excluir sua própria conta de administrador.');
    }

    await deleteDoc(doc(db, 'app_users', id));
    try {
      await deleteDoc(doc(db, 'system_users', id));
    } catch (e) {
      // secondary
    }

    await refreshUsers();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'employee',
        isAdmin: currentUser?.role === 'admin',
        permissions: currentUser?.permissions || getDefaultPermissions('employee'),
        loading,
        needsInitialSetup,
        connectionError,
        isVercelOrClientMode,
        login,
        setupInitialAdmin,
        resetAdminPassword,
        retryConnection: checkAuth,
        signOutApp,
        systemUsers,
        refreshUsers,
        createUser,
        updateUser,
        deleteUserAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
