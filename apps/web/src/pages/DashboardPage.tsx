import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../api/client';
import { can, PermissionKeys } from '../auth/permissionKeys';
import { useAuth } from '../auth/AuthContext';

type Dashboard = {
  clientsCount: number;
  openDeals: number;
  propertiesByStatus: { status: string; _count: number }[];
  dealsByType: Record<string, number>;
  financeThisMonth: { expenses: string; incomes: string } | null;
  overdueSchedules: number;
};

type CashRow = { month: string; inflow: string; outflow: string };

type OverdueRow = {
  id: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: string;
  deal: {
    type: string;
    dealStage: { name: string } | null;
    client: { firstName: string | null; lastName: string | null; companyName: string | null };
  };
};

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [cashflow, setCashflow] = useState<CashRow[] | null>(null);
  const [profit, setProfit] = useState<{ income: string; expense: string; net: string } | null>(null);
  const [overdueList, setOverdueList] = useState<OverdueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseCurrency = user?.organization?.baseCurrency ?? 'UZS';

  const period = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), 0, 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiFetch<Dashboard>('/api/reports/dashboard');
        if (!cancelled) setData(d);
        if (can(user, PermissionKeys.REPORTS_READ)) {
          const [cf, pr] = await Promise.all([
            apiFetch<CashRow[]>('/api/finance/aggregations/cashflow?months=8'),
            apiFetch<{ income: string; expense: string; net: string }>(
              `/api/finance/aggregations/profit?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`,
            ),
          ]);
          if (!cancelled) {
            setCashflow(cf);
            setProfit(pr);
          }
        }
        if (can(user, PermissionKeys.FINANCE_SCHEDULES)) {
          const od = await apiFetch<OverdueRow[]>('/api/finance/aggregations/overdue-detailed');
          if (!cancelled) setOverdueList(od);
        }
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, period.from, period.to]);

  const chartData = useMemo(
    () =>
      (cashflow ?? []).map((c) => ({
        month: c.month,
        Доходы: Number(c.inflow),
        Расходы: Number(c.outflow),
      })),
    [cashflow],
  );

  function clientLabel(c: OverdueRow['deal']['client']) {
    if (c.companyName) return c.companyName;
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
  }

  return (
    <div>
      <h1 className="page-title">Обзор</h1>
      <p className="page-sub">
        Филиал: <strong>{user?.organization?.name ?? '—'}</strong>
        {user?.organization?.baseCurrency ? (
          <>
            {' '}
            · базовая валюта: <strong>{baseCurrency}</strong>
          </>
        ) : null}
      </p>
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!data && !error ? <div className="empty">Загрузка…</div> : null}
      {data ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div className="card">
            <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Клиенты</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 6 }}>{data.clientsCount}</div>
          </div>
          <div className="card">
            <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Открытые сделки</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 6 }}>{data.openDeals}</div>
          </div>
          <div className="card">
            <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Просрочки графика</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 6 }}>{data.overdueSchedules}</div>
          </div>
          {data.financeThisMonth ? (
            <>
              <div className="card">
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Расходы (мес.)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 6 }}>
                  {data.financeThisMonth.expenses}
                </div>
              </div>
              <div className="card">
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Доходы (мес.)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 6 }}>
                  {data.financeThisMonth.incomes}
                </div>
              </div>
            </>
          ) : null}
          {profit ? (
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>P&amp;L с начала года ({baseCurrency})</div>
              <div style={{ marginTop: 8, fontSize: '0.9rem', lineHeight: 1.6 }}>
                Доходы: <strong>{profit.income}</strong>
                <br />
                Расходы: <strong>{profit.expense}</strong>
                <br />
                Чистый: <strong>{profit.net}</strong>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {chartData.length > 0 ? (
        <div className="card" style={{ marginTop: 20, height: 320 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Денежный поток по месяцам ({baseCurrency})</div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <Legend />
              <Bar dataKey="Доходы" fill="var(--success)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Расходы" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : can(user, PermissionKeys.REPORTS_READ) && data ? (
        <p className="page-sub" style={{ marginTop: 16 }}>
          Нет данных для графика денежного потока (нужны проводки за выбранный период).
        </p>
      ) : null}

      {overdueList && overdueList.length > 0 ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Просроченные платежи по графику</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Срок</th>
                  <th>Сумма</th>
                  <th>Сделка</th>
                  <th>Клиент</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {overdueList.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.dueDate).toLocaleDateString('ru-RU')}</td>
                    <td style={{ fontWeight: 600 }}>
                      {r.amount} {r.currency}
                    </td>
                    <td>
                      <span className="badge badge-accent">{r.deal.type}</span>{' '}
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                        {r.deal.dealStage?.name ?? '—'}
                      </span>
                    </td>
                    <td>{clientLabel(r.deal.client)}</td>
                    <td>
                      <span className="badge badge-warn">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data ? (
        <div style={{ marginTop: 20, display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Объекты по статусам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.propertiesByStatus.map((p) => (
                <div key={p.status} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="badge">{p.status}</span>
                  <span>{p._count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Сделки по типам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(data.dealsByType).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="badge badge-accent">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
