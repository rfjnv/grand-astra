import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 0) {
          setError(
            'Сервер не отвечает. Запустите API (например npm run dev -w @grandastra/api) или проверьте VITE_API_URL.',
          );
        } else if (e.status === 401) {
          setError(e.message || 'Неверный email или пароль.');
        } else if (e.status === 400) {
          setError(e.message || 'Проверьте формат email и длину пароля (не меньше 6 символов).');
        } else {
          setError(e.message || 'Не удалось войти.');
        }
      } else {
        setError('Не удалось войти. Проверьте email и пароль.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 'min(420px, 100%)' }}>
        <h1 className="page-title">Вход в CRM</h1>
        <p className="page-sub">Grand Astra — продажи, аренда, строительство</p>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--muted)' }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              style={{
                padding: '0.55rem 0.65rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--muted)' }}>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                padding: '0.55rem 0.65rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
              }}
            />
          </label>
          {error ? (
            <div style={{ color: 'var(--danger)', fontSize: '0.88rem' }}>{error}</div>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              padding: '0.65rem',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)',
              color: 'white',
              fontWeight: 600,
            }}
          >
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
