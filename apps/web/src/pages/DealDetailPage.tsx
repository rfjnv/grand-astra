import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { can, PermissionKeys } from '../auth/permissionKeys';

type DealDetail = {
  id: string;
  type: 'SALE' | 'RENT' | 'CONSTRUCTION';
  amount: string | null;
  closedAt: string | null;
  dealStage: { id: string; name: string } | null;
  client: { firstName: string | null; lastName: string | null; companyName: string | null } | null;
  responsible: { firstName: string | null; lastName: string | null } | null;
};
type StageOption = { id: string; name: string; dealType: 'SALE' | 'RENT' | 'CONSTRUCTION' };

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
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [savingStage, setSavingStage] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch<StageOption[]>('/api/deal-stages');
        if (!cancelled) {
          setStages(response);
        }
      } catch {
        /* ignore optional stage loading errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountLabel = useMemo(() => {
    if (!deal?.amount) return '—';
    const amount = Number(deal.amount);
    if (Number.isNaN(amount)) return deal.amount;
    return amount.toLocaleString('ru-RU');
  }, [deal?.amount]);

  const canEditStage = can(user, PermissionKeys.DEALS_WRITE);
  const stageOptions = useMemo(
    () => stages.filter((stage) => stage.dealType === deal?.type),
    [stages, deal?.type],
  );

  async function onStageChange(nextStageId: string) {
    if (!id || !deal || nextStageId === deal.dealStage?.id) return;
    setSavingStage(true);
    setError(null);
    try {
      const updated = await apiFetch<DealDetail>(`/api/deals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ dealStageId: nextStageId }),
      });
      setDeal(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить этап');
    } finally {
      setSavingStage(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header className="card" style={{ display: 'grid', gap: 10 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Сделка {deal?.id ?? id ?? '—'}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-accent">TYPE: {deal?.type ?? '—'}</span>
          {canEditStage ? (
            <label className="badge" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              STAGE:
              <select
                value={deal?.dealStage?.id ?? ''}
                onChange={(e) => void onStageChange(e.target.value)}
                disabled={savingStage || !deal || stageOptions.length === 0}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: '0.72rem',
                  padding: 0,
                }}
              >
                <option value="">—</option>
                {stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="badge">STATUS: {deal?.dealStage?.name ?? '—'}</span>
          )}
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
