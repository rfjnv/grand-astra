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

type ClientRow = {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  status: string;
  leadSource: string | null;
  assignedUser: { id: string; firstName: string; lastName: string } | null;
};

type UserOpt = { id: string; firstName: string; lastName: string };

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function ClientsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fStatus, setFStatus] = useState('');
  const [fAssigned, setFAssigned] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const [formType, setFormType] = useState<'PERSON' | 'COMPANY'>('PERSON');
  const [formFirst, setFormFirst] = useState('');
  const [formLast, setFormLast] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formStatus, setFormStatus] = useState('NEW');
  const [formLead, setFormLead] = useState('');
  const [formAssigned, setFormAssigned] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadList = useCallback(async () => {
    const qs = buildQuery({
      status: fStatus || undefined,
      assignedUserId: fAssigned || undefined,
      createdFrom: fFrom || undefined,
      createdTo: fTo || undefined,
    });
    const list = await apiFetch<ClientRow[]>(`/api/clients${qs}`);
    setRows(list);
  }, [fStatus, fAssigned, fFrom, fTo]);

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
    let cancelled = false;
    (async () => {
      if (!can(user, PermissionKeys.USERS_LIST)) {
        if (user) setUsers([{ id: user.id, firstName: user.firstName, lastName: user.lastName }]);
        return;
      }
      try {
        const us = await apiFetch<UserOpt[]>('/api/users');
        if (!cancelled) setUsers(us);
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
    setFormType('PERSON');
    setFormFirst('');
    setFormLast('');
    setFormCompany('');
    setFormStatus('NEW');
    setFormLead('');
    setFormAssigned(user?.id ?? '');
    setFormNotes('');
    setModal(true);
  }

  async function openEdit(id: string) {
    try {
      const c = await apiFetch<{
        id: string;
        type: string;
        firstName: string | null;
        lastName: string | null;
        companyName: string | null;
        status: string;
        leadSource: string | null;
        notes: string | null;
        assignedUserId: string | null;
      }>(`/api/clients/${id}`);
      setEditId(id);
      setFormType(c.type === 'COMPANY' ? 'COMPANY' : 'PERSON');
      setFormFirst(c.firstName ?? '');
      setFormLast(c.lastName ?? '');
      setFormCompany(c.companyName ?? '');
      setFormStatus(c.status);
      setFormLead(c.leadSource ?? '');
      setFormAssigned(c.assignedUserId ?? '');
      setFormNotes(c.notes ?? '');
      setModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        type: formType,
        firstName: formType === 'PERSON' ? formFirst || undefined : undefined,
        lastName: formType === 'PERSON' ? formLast || undefined : undefined,
        companyName: formType === 'COMPANY' ? formCompany || undefined : undefined,
        status: formStatus,
        leadSource: formLead || undefined,
        assignedUserId: formAssigned || undefined,
        notes: formNotes || undefined,
      };
      if (editId) {
        await apiFetch(`/api/clients/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  function name(c: ClientRow) {
    if (c.type === 'COMPANY') return c.companyName ?? '—';
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
  }

  const canWrite = can(user, PermissionKeys.CLIENTS_WRITE);

  return (
    <div>
      <h1 className="page-title">Клиенты</h1>
      <p className="page-sub">Карточки и ответственные; фильтры по статусу и дате создания.</p>

      <div
        className="card"
        style={{ marginBottom: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
      >
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Статус
          <input value={fStatus} onChange={(e) => setFStatus(e.target.value)} placeholder="NEW, …" style={input} />
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Ответственный
          <select value={fAssigned} onChange={(e) => setFAssigned(e.target.value)} style={input}>
            <option value="">Все</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Создан с
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          по
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} style={input} />
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
            Новый клиент
          </button>
        </div>
      ) : null}

      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!rows && !error ? <div className="empty">Загрузка…</div> : null}
      {rows?.length === 0 ? <div className="empty">Нет клиентов.</div> : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Имя / компания</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Ответственный</th>
                <th>Источник</th>
                {canWrite ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{name(c)}</td>
                  <td>
                    <span className="badge">{c.type}</span>
                  </td>
                  <td>{c.status}</td>
                  <td style={{ color: 'var(--muted)' }}>
                    {c.assignedUser ? `${c.assignedUser.firstName} ${c.assignedUser.lastName}` : '—'}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{c.leadSource ?? '—'}</td>
                  {canWrite ? (
                    <td>
                      <button
                        type="button"
                        onClick={() => void openEdit(c.id)}
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

      <Modal open={modal} title={editId ? 'Клиент' : 'Новый клиент'} onClose={() => setModal(false)}>
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Тип
            <select value={formType} onChange={(e) => setFormType(e.target.value as 'PERSON' | 'COMPANY')} style={input}>
              <option value="PERSON">Физлицо</option>
              <option value="COMPANY">Компания</option>
            </select>
          </label>
          {formType === 'COMPANY' ? (
            <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Название компании
              <input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} style={input} required />
            </label>
          ) : (
            <>
              <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Имя
                <input value={formFirst} onChange={(e) => setFormFirst(e.target.value)} style={input} />
              </label>
              <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Фамилия
                <input value={formLast} onChange={(e) => setFormLast(e.target.value)} style={input} />
              </label>
            </>
          )}
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Статус
            <input value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={input} />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Источник лида
            <input value={formLead} onChange={(e) => setFormLead(e.target.value)} style={input} />
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Ответственный
            <select value={formAssigned} onChange={(e) => setFormAssigned(e.target.value)} style={input}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Заметки
            <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} style={{ ...input, minHeight: 72 }} />
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
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
