import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { can, PermissionKeys } from '../auth/permissionKeys';
import { useAuth } from '../auth/AuthContext';

type Point = { month: string; total: number };

export function ReportsPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = can(user, PermissionKeys.REPORTS_READ);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<Point[]>('/api/reports/sales-by-month?months=8');
        if (!cancelled) setSales(data);
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
        <h1 className="page-title">Отчёты</h1>
        <p className="page-sub">Нужно право reports.read.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Отчёты</h1>
      <p className="page-sub">Продажи по месяцам (закрытые сделки SALE).</p>
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!sales && !error ? <div className="empty">Загрузка…</div> : null}
      {sales && sales.length === 0 ? <div className="empty">Нет закрытых продаж за период.</div> : null}
      {sales && sales.length > 0 ? (
        <div className="card" style={{ maxWidth: 520 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sales.map((s) => (
              <div key={s.month} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{s.month}</span>
                <span style={{ fontWeight: 600 }}>{s.total.toLocaleString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
