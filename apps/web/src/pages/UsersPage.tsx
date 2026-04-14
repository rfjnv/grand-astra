import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { can, PermissionKeys } from '../auth/permissionKeys';
import { useAuth } from '../auth/AuthContext';

type Row = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { slug: string; name: string };
  isActive: boolean;
  department: { name: string } | null;
};

export function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = can(user, PermissionKeys.USERS_LIST);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch<Row[]>('/api/users');
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <div>
        <h1 className="page-title">Команда и роли</h1>
        <p className="page-sub">Список пользователей доступен при праве users.list.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Команда и роли</h1>
      <p className="page-sub">Роли и права задаются в организации (кастомные наборы permissions).</p>
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!rows && !error ? <div className="empty">Загрузка…</div> : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Отдел</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    {u.firstName} {u.lastName}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                  <td>
                    <span className="badge badge-accent" title={u.role.slug}>
                      {u.role.name}
                    </span>
                  </td>
                  <td>{u.department?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
