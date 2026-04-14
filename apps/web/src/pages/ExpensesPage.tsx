import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { apiFetch } from '../api/client';
import { can, PermissionKeys } from '../auth/permissionKeys';
import { useAuth } from '../auth/AuthContext';
import { Modal } from '../components/Modal';

const input: CSSProperties = {
  padding: '0.5rem 0.6rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  width: '100%',
};

type Row = {
  id: string;
  paymentDate: string;
  amount: string;
  currency: string;
  expenseType: string;
  status: string;
  scope: string;
  comment: string | null;
};

type UserOpt = { id: string; firstName: string; lastName: string };
type ClientOpt = { id: string; companyName: string | null; firstName: string | null; lastName: string | null };
type DealOpt = { id: string; type: string };
type PropertyOpt = { id: string; title: string | null; addressLine: string };

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

function clientLabel(c: ClientOpt) {
  if (c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id.slice(0, 8);
}

export function ExpensesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [deals, setDeals] = useState<DealOpt[]>([]);
  const [properties, setProperties] = useState<PropertyOpt[]>([]);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fResponsible, setFResponsible] = useState('');

  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('UZS');
  const [formType, setFormType] = useState('Операционные');
  const [formScope, setFormScope] = useState('COMPANY');
  const [formStatus, setFormStatus] = useState('PAID');
  const [formComment, setFormComment] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formDealId, setFormDealId] = useState('');
  const [formPropertyId, setFormPropertyId] = useState('');

  const allowedRead = can(user, PermissionKeys.FINANCE_READ);
  const allowedWrite = can(user, PermissionKeys.FINANCE_WRITE);

  const loadList = useCallback(async () => {
    const qs = buildQuery({
      from: fFrom || undefined,
      to: fTo || undefined,
      status: fStatus || undefined,
      responsibleId: fResponsible || undefined,
    });
    const list = await apiFetch<Row[]>(`/api/finance/expenses${qs}`);
    setRows(list);
  }, [fFrom, fTo, fStatus, fResponsible]);

  useEffect(() => {
    if (!allowedRead) return;
    let cancelled = false;
    (async () => {
      try {
        await loadList();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowedRead, loadList]);

  useEffect(() => {
    if (!allowedWrite) return;
    let cancelled = false;
    (async () => {
      try {
        const [cl, dl, pr] = await Promise.all([
          can(user, PermissionKeys.CLIENTS_READ) ? apiFetch<ClientOpt[]>('/api/clients') : Promise.resolve([]),
          can(user, PermissionKeys.DEALS_READ) ? apiFetch<DealOpt[]>('/api/deals') : Promise.resolve([]),
          can(user, PermissionKeys.PROPERTIES_READ) ? apiFetch<PropertyOpt[]>('/api/properties') : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setClients(cl);
        setDeals(dl);
        setProperties(pr);
        if (can(user, PermissionKeys.USERS_LIST)) {
          const us = await apiFetch<UserOpt[]>('/api/users');
          if (!cancelled) setUsers(us);
        } else if (user) {
          setUsers([{ id: user.id, firstName: user.firstName, lastName: user.lastName }]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowedWrite, user]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!formAmount) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        paymentDate: new Date(formDate).toISOString(),
        amount: Number(formAmount),
        currency: formCurrency,
        expenseType: formType,
        scope: formScope,
        status: formStatus,
        comment: formComment || undefined,
        clientId: formScope === 'CLIENT' || formScope === 'DEAL' ? formClientId || undefined : undefined,
        dealId: formScope === 'DEAL' ? formDealId || undefined : undefined,
        propertyId: formScope === 'PROPERTY' ? formPropertyId || undefined : undefined,
      };
      await apiFetch('/api/finance/expenses', { method: 'POST', body: JSON.stringify(body) });
      setModal(false);
      setFormAmount('');
      setFormComment('');
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (!allowedRead) {
    return (
      <div>
        <h1 className="page-title">Расходы</h1>
        <p className="page-sub">Нужно право finance.read.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Расходы</h1>
      <p className="page-sub">Мультивалюта и нормализация на бэкенде; фильтры по периоду и статусу.</p>

      <div
        className="card"
        style={{ marginBottom: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
      >
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Дата с
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          по
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Статус
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={input}>
            <option value="">Все</option>
            <option value="PLANNED">PLANNED</option>
            <option value="PAID">PAID</option>
            <option value="OVERDUE">OVERDUE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Создал запись
          <select value={fResponsible} onChange={(e) => setFResponsible(e.target.value)} style={input}>
            <option value="">Все</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {allowedWrite ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setModal(true)}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)',
              color: 'white',
              fontWeight: 600,
            }}
          >
            Новый расход
          </button>
        </div>
      ) : null}

      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!rows && !error ? <div className="empty">Загрузка…</div> : null}
      {rows?.length === 0 ? <div className="empty">Нет расходов.</div> : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Тип</th>
                <th>Область</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.paymentDate).toLocaleDateString('ru-RU')}</td>
                  <td style={{ fontWeight: 600 }}>
                    {r.amount} {r.currency}
                  </td>
                  <td>{r.expenseType}</td>
                  <td>
                    <span className="badge">{r.scope}</span>
                  </td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal open={modal} title="Новый расход" onClose={() => setModal(false)}>
        <form onSubmit={(e) => void onCreate(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Дата оплаты
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={input} required />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Сумма
            <input value={formAmount} onChange={(e) => setFormAmount(e.target.value)} style={input} inputMode="decimal" required />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Валюта
            <input value={formCurrency} onChange={(e) => setFormCurrency(e.target.value.toUpperCase())} style={input} />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Тип расхода
            <input value={formType} onChange={(e) => setFormType(e.target.value)} style={input} required />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Область
            <select value={formScope} onChange={(e) => setFormScope(e.target.value)} style={input}>
              <option value="COMPANY">COMPANY</option>
              <option value="CLIENT">CLIENT</option>
              <option value="DEAL">DEAL</option>
              <option value="PROPERTY">PROPERTY</option>
              <option value="CONSTRUCTION">CONSTRUCTION</option>
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Статус
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={input}>
              <option value="PLANNED">PLANNED</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>
          {(formScope === 'CLIENT' || formScope === 'DEAL') && clients.length > 0 ? (
            <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Клиент
              <select value={formClientId} onChange={(e) => setFormClientId(e.target.value)} style={input}>
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {formScope === 'DEAL' ? (
            <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Сделка
              <select value={formDealId} onChange={(e) => setFormDealId(e.target.value)} style={input}>
                <option value="">—</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.type} · {d.id.slice(0, 8)}…
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {formScope === 'PROPERTY' ? (
            <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Объект
              <select value={formPropertyId} onChange={(e) => setFormPropertyId(e.target.value)} style={input}>
                <option value="">—</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title ?? p.addressLine}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Комментарий
            <textarea value={formComment} onChange={(e) => setFormComment(e.target.value)} style={{ ...input, minHeight: 64 }} />
          </label>
          <button
            type="submit"
            disabled={saving}
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
            {saving ? 'Создание…' : 'Создать'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
