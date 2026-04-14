import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotificationsBell } from '../components/NotificationsBell';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clients', label: 'Клиенты' },
  { to: '/properties', label: 'Объекты' },
  { to: '/deals', label: 'Сделки' },
  { to: '/construction', label: 'Стройка' },
  { to: '/expenses', label: 'Расходы' },
  { to: '/payments', label: 'Платежи' },
  { to: '/reports', label: 'Отчёты' },
  { to: '/users', label: 'Команда' },
  { to: '/settings', label: 'Настройки' },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 256,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.1rem 0.8rem',
        }}
      >
        <div style={{ padding: '0.35rem 0.65rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, letterSpacing: '-0.03em', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent)', fontSize: '1.3rem' }}>&#9733;</span>
            Grand Astra
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>CRM Platform</div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12, flex: 1 }}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                padding: '0.5rem 0.7rem',
                borderRadius: 8,
                color: isActive ? 'var(--accent-text)' : 'var(--muted)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                border: isActive ? '1px solid rgba(212, 164, 78, 0.25)' : '1px solid transparent',
                fontSize: '0.88rem',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s ease',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 12,
            fontSize: '0.82rem',
            color: 'var(--muted)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <NotificationsBell />
          </div>
          <div style={{ color: 'var(--text)', fontWeight: 600 }}>
            {user?.firstName} {user?.lastName}
          </div>
          <div style={{ marginTop: 2 }}>{user?.email}</div>
          <span className="badge badge-accent" style={{ marginTop: 8 }} title={user?.roleSlug}>
            {user?.roleName}
          </span>
          <button
            type="button"
            onClick={logout}
            style={{
              marginTop: 12,
              width: '100%',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted)',
              padding: '0.5rem',
              fontSize: '0.85rem',
              transition: 'border-color 0.15s ease',
            }}
          >
            Выйти
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '1.5rem 1.75rem', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
