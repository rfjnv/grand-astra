const TOKEN_KEY = 'grandastra_token';

/** В Docker/production задаётся VITE_API_URL (например http://localhost:3000). Локально пусто — работает proxy Vite. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function parseErrorMessage(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(' ');
    if (typeof j.message === 'string') return j.message;
  } catch {
    /* not JSON */
  }
  return text || fallback;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ApiError(msg, 0);
  }
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) setToken(null);
    const message = parseErrorMessage(text, res.statusText);
    throw new ApiError(message, res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
