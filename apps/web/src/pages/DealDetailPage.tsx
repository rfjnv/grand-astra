import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';

type DealDetail = {
  id: string;
  type: 'SALE' | 'RENT' | 'CONSTRUCTION';
  amount: string | null;
  closedAt: string | null;
  dealStage: { id: string; name: string } | null;
  client: { firstName: string | null; lastName: string | null; companyName: string | null } | null;
  responsible: { firstName: string | null; lastName: string | null } | null;
};

function clientLabel(client: DealDetail['client']) {
  if (!client) return '—';
  if (client.companyName) return client.companyName;
  return [client.firstName, client.lastName].filter(Boolean).join(' ') || '—';
}

function userLabel(user: DealDetail['responsible']) {
  if (!user) return '—';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
}

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('ID сделки не найден');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await apiFetch<DealDetail>(`/api/deals/${id}`);
        if (!cancelled) {
          setDeal(response);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки сделки');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const amountLabel = useMemo(() => {
    if (!deal?.amount) return '—';
    const amount = Number(deal.amount);
    if (Number.isNaN(amount)) return deal.amount;
    return amount.toLocaleString('ru-RU');
  }, [deal?.amount]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header className="card" style={{ display: 'grid', gap: 10 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Сделка {deal?.id ?? id ?? '—'}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-accent">TYPE: {deal?.type ?? '—'}</span>
          <span className="badge">STATUS: {deal?.dealStage?.name ?? '—'}</span>
        </div>
      </header>

      <section className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: 4 }}>Клиент</div>
          <div>{clientLabel(deal?.client ?? null)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: 4 }}>Сумма</div>
          <div>{amountLabel}</div>
        </div>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: 4 }}>Ответственный</div>
          <div>{userLabel(deal?.responsible ?? null)}</div>
        </div>
      </section>

      {loading ? <div className="empty">Загрузка сделки…</div> : null}
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}

      <section className="card">
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Activity</h2>
        <div className="empty" style={{ padding: '0.5rem 0' }}>
          Empty section
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Payments</h2>
        <div className="empty" style={{ padding: '0.5rem 0' }}>
          Empty section
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>History</h2>
        <div className="empty" style={{ padding: '0.5rem 0' }}>
          Empty section
        </div>
      </section>
    </div>
  );
}
