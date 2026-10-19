import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, UserRole, UserPermissions, getDefaultPermissions } from '../types';

interface AuthContextType {
  currentUser: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  permissions: UserPermissions;
  loading: boolean;
  needsInitialSetup: boolean;
  login: (username: string, pass: string) => Promise<void>;
  setupInitialAdmin: (username: string, pass: string, name: string) => Promise<void>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [systemUsers, setSystemUsers] = useState<UserProfile[]>([]);

  // Check system status & verify existing session token
  const checkAuth = useCallback(async () => {
    try {
      // 1. Check if an admin exists
      const statusRes = await fetch('/api/auth/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setNeedsInitialSetup(Boolean(statusData.needsInitialSetup));
      }

      // 2. If token exists, verify with server
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData.user);
          setToken(savedToken);
        } else {
          // Token invalid or expired
          localStorage.removeItem(TOKEN_KEY);
          setCurrentUser(null);
          setToken(null);
        }
      } else {
        setCurrentUser(null);
        setToken(null);
      }
    } catch (err) {
      console.error('Error during auth check:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load system users (Admin only)
  const refreshUsers = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) return;

    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSystemUsers(data.users || []);
      }
    } catch (err) {
      console.warn('Failed to load users list:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      refreshUsers();
    } else {
      setSystemUsers([]);
    }
  }, [currentUser, refreshUsers]);

  // Setup initial admin
  const setupInitialAdmin = async (username: string, pass: string, name: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: pass,
          displayName: name.trim() || 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao configurar administrador inicial.');
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setNeedsInitialSetup(false);
    } finally {
      setLoading(false);
    }
  };

  // Login with username & password
  const login = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: pass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao autenticar.');
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setCurrentUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const signOutApp = async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch (e) {
        console.warn('Logout API call failed:', e);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
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
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) throw new Error('Não autenticado.');

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao criar usuário.');
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
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) throw new Error('Não autenticado.');

    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify(updateData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao atualizar usuário.');
    }

    // If updated self, refresh currentUser
    if (currentUser && currentUser.id === id) {
      setCurrentUser(data.user);
    }

    await refreshUsers();
  };

  // Delete user (Admin only)
  const deleteUserAccount = async (id: string) => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) throw new Error('Não autenticado.');

    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao remover usuário.');
    }

    await refreshUsers();
  };

  const role: UserRole = currentUser?.role || 'employee';
  const isAdmin = role === 'admin';
  const permissions: UserPermissions = currentUser?.permissions || getDefaultPermissions(role);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isAdmin,
        permissions,
        loading,
        needsInitialSetup,
        login,
        setupInitialAdmin,
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
