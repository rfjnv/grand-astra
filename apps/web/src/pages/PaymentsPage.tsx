import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type Schedule = {
  id: string;
  dueDate: string;
  amount: string;
  currency: string;
  purpose: string;
  status: string;
  deal: { id: string; type: string; dealStage: { id: string; name: string; sortOrder: number } | null };
};

export function PaymentsPage() {
  const [rows, setRows] = useState<Schedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch<Schedule[]>('/api/finance/schedules');
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
      <h1 className="page-title">Платежи и график</h1>
      <p className="page-sub">Запланированные платежи по сделкам (аренда, рассрочка, стройка).</p>
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!rows && !error ? <div className="empty">Загрузка…</div> : null}
      {rows?.length === 0 ? <div className="empty">График пуст.</div> : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Срок</th>
                <th>Сумма</th>
                <th>Назначение</th>
                <th>Сделка</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.dueDate).toLocaleDateString('ru-RU')}</td>
                  <td style={{ fontWeight: 600 }}>
                    {r.amount} {r.currency}
                  </td>
                  <td>{r.purpose}</td>
                  <td>
                    <span className="badge badge-accent">{r.deal.type}</span>{' '}
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      {r.deal.dealStage?.name ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className={r.status === 'OVERDUE' ? 'badge badge-warn' : 'badge'}>{r.status}</span>
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
