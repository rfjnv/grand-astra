import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, getToken, setToken } from '../api/client';

type MeApi = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  departmentId: string | null;
  role: {
    id: string;
    name: string;
    slug: string;
    permissions: { permission: { key: string } }[];
  };
  organization?: { id: string; name: string; code: string; baseCurrency: string };
  department?: { id: string; name: string } | null;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  departmentId: string | null;
  roleId: string;
  roleSlug: string;
  roleName: string;
  permissionKeys: string[];
  organization?: { id: string; name: string; code: string; baseCurrency: string };
  department?: { id: string; name: string } | null;
};

function mapMe(raw: MeApi): AuthUser {
  const permissionKeys = raw.role.permissions.map((p) => p.permission.key);
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    organizationId: raw.organizationId,
    departmentId: raw.departmentId,
    roleId: raw.role.id,
    roleSlug: raw.role.slug,
    roleName: raw.role.name,
    permissionKeys,
    organization: raw.organization,
    department: raw.department ?? undefined,
  };
}

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const raw = await apiFetch<MeApi>('/api/auth/me');
      setUser(mapMe(raw));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.accessToken);
    const raw = await apiFetch<MeApi>('/api/auth/me');
    setUser(mapMe(raw));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
