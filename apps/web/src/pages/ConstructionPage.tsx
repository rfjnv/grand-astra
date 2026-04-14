import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type Row = {
  id: string;
  name: string;
  status: string;
  budgetAmount: string | null;
  currency: string;
  siteAddress: string | null;
};

export function ConstructionPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch<Row[]>('/api/construction/projects');
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Строительство</h1>
      <p className="page-sub">Проекты, этапы, подрядчики и материалы — через API.</p>
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!rows && !error ? <div className="empty">Загрузка…</div> : null}
      {rows?.length === 0 ? <div className="empty">Нет проектов.</div> : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Проект</th>
                <th>Адрес</th>
                <th>Статус</th>
                <th>Бюджет</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{p.siteAddress ?? '—'}</td>
                  <td>{p.status}</td>
                  <td>
                    {p.budgetAmount ? `${p.budgetAmount} ${p.currency}` : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
