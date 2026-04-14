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

  const inputStyle = {
    padding: '0.65rem 0.75rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'radial-gradient(ellipse 800px 500px at 50% 30%, rgba(212, 164, 78, 0.04) 0%, transparent 70%)',
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '2rem 1.75rem',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--accent)', fontSize: '2rem', marginBottom: 4 }}>&#9733;</div>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
            Grand Astra
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
            Продажи, аренда, строительство
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--muted)', fontWeight: 500 }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="user@grandastra.local"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--muted)', fontWeight: 500 }}>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Введите пароль"
              style={inputStyle}
            />
          </label>
          {error ? (
            <div
              style={{
                color: 'var(--danger)',
                fontSize: '0.85rem',
                background: 'var(--danger-soft)',
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                border: '1px solid rgba(244, 88, 123, 0.2)',
              }}
            >
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 6,
              padding: '0.7rem',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)',
              color: '#0a0b10',
              fontWeight: 700,
              fontSize: '0.92rem',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.15s ease',
            }}
          >
            {busy ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
