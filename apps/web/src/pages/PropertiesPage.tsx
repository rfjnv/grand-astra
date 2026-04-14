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
  kind: string;
  title: string | null;
  addressLine: string;
  status: string;
  salePrice: string | null;
  rentPrice: string | null;
  currency: string;
};

type ClientOpt = { id: string; companyName: string | null; firstName: string | null; lastName: string | null };

function clientLabel(c: ClientOpt) {
  if (c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id.slice(0, 8);
}

export function PropertiesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState('');
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formKind, setFormKind] = useState('APARTMENT');
  const [formTitle, setFormTitle] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formSale, setFormSale] = useState('');
  const [formRent, setFormRent] = useState('');
  const [formCurrency, setFormCurrency] = useState('UZS');
  const [formStatus, setFormStatus] = useState('AVAILABLE');
  const [formOwner, setFormOwner] = useState('');

  const loadList = useCallback(async () => {
    const qs = fStatus ? `?status=${encodeURIComponent(fStatus)}` : '';
    const list = await apiFetch<Row[]>(`/api/properties${qs}`);
    setRows(list);
  }, [fStatus]);

  useEffect(() => {
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
  }, [loadList]);

  useEffect(() => {
    if (!can(user, PermissionKeys.CLIENTS_READ)) return;
    let cancelled = false;
    (async () => {
      try {
        const cl = await apiFetch<ClientOpt[]>('/api/clients');
        if (!cancelled) setClients(cl);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function openCreate() {
    setEditId(null);
    setFormKind('APARTMENT');
    setFormTitle('');
    setFormAddress('');
    setFormCity('');
    setFormSale('');
    setFormRent('');
    setFormCurrency('UZS');
    setFormStatus('AVAILABLE');
    setFormOwner('');
    setModal(true);
  }

  async function openEdit(id: string) {
    try {
      const p = await apiFetch<{
        id: string;
        kind: string;
        title: string | null;
        addressLine: string;
        city: string | null;
        salePrice: string | null;
        rentPrice: string | null;
        currency: string;
        status: string;
        ownerClientId: string | null;
      }>(`/api/properties/${id}`);
      setEditId(id);
      setFormKind(p.kind);
      setFormTitle(p.title ?? '');
      setFormAddress(p.addressLine);
      setFormCity(p.city ?? '');
      setFormSale(p.salePrice ?? '');
      setFormRent(p.rentPrice ?? '');
      setFormCurrency(p.currency);
      setFormStatus(p.status);
      setFormOwner(p.ownerClientId ?? '');
      setModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formAddress.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        kind: formKind,
        title: formTitle || undefined,
        addressLine: formAddress,
        city: formCity || undefined,
        salePrice: formSale ? Number(formSale) : undefined,
        rentPrice: formRent ? Number(formRent) : undefined,
        currency: formCurrency,
        status: formStatus,
        ownerClientId: formOwner || undefined,
      };
      if (editId) {
        await apiFetch(`/api/properties/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/properties', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  const canWrite = can(user, PermissionKeys.PROPERTIES_WRITE);

  return (
    <div>
      <h1 className="page-title">Объекты</h1>
      <p className="page-sub">Недвижимость: фильтр по статусу, создание и редактирование.</p>

      <div className="card" style={{ marginBottom: 16, maxWidth: 280 }}>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Статус
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={input}>
            <option value="">Все</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="RESERVED">RESERVED</option>
            <option value="SOLD">SOLD</option>
            <option value="LEASED">LEASED</option>
            <option value="UNDER_CONSTRUCTION">UNDER_CONSTRUCTION</option>
          </select>
        </label>
      </div>

      {canWrite ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={openCreate}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)',
              color: 'white',
              fontWeight: 600,
            }}
          >
            Новый объект
          </button>
        </div>
      ) : null}

      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!rows && !error ? <div className="empty">Загрузка…</div> : null}
      {rows?.length === 0 ? <div className="empty">Нет объектов в базе.</div> : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Адрес</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Продажа</th>
                <th>Аренда</th>
                {canWrite ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.title ?? p.addressLine}</div>
                    {p.title ? <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{p.addressLine}</div> : null}
                  </td>
                  <td>
                    <span className="badge">{p.kind}</span>
                  </td>
                  <td>{p.status}</td>
                  <td>
                    {p.salePrice ? `${p.salePrice} ${p.currency}` : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td>
                    {p.rentPrice ? `${p.rentPrice} ${p.currency}` : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  {canWrite ? (
                    <td>
                      <button
                        type="button"
                        onClick={() => void openEdit(p.id)}
                        style={{
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--accent)',
                          borderRadius: 6,
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.45rem',
                        }}
                      >
                        Изменить
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal open={modal} title={editId ? 'Объект' : 'Новый объект'} onClose={() => setModal(false)}>
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Тип
            <select value={formKind} onChange={(e) => setFormKind(e.target.value)} style={input} required>
              <option value="HOUSE">HOUSE</option>
              <option value="LAND">LAND</option>
              <option value="APARTMENT">APARTMENT</option>
              <option value="COMMERCIAL">COMMERCIAL</option>
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Заголовок
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={input} />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Адрес (строка)
            <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} style={input} required />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Город
            <input value={formCity} onChange={(e) => setFormCity(e.target.value)} style={input} />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Цена продажи
            <input value={formSale} onChange={(e) => setFormSale(e.target.value)} style={input} inputMode="decimal" />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Аренда
            <input value={formRent} onChange={(e) => setFormRent(e.target.value)} style={input} inputMode="decimal" />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Валюта
            <input value={formCurrency} onChange={(e) => setFormCurrency(e.target.value.toUpperCase())} style={input} />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Статус
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={input}>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="RESERVED">RESERVED</option>
              <option value="SOLD">SOLD</option>
              <option value="LEASED">LEASED</option>
              <option value="UNDER_CONSTRUCTION">UNDER_CONSTRUCTION</option>
            </select>
          </label>
          {clients.length > 0 ? (
            <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Владелец (клиент)
              <select value={formOwner} onChange={(e) => setFormOwner(e.target.value)} style={input}>
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
