import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
  type: string;
  amount: string | null;
  closedAt: string | null;
  updatedAt: string;
  dealStage: { id: string; name: string; sortOrder: number };
  client: { firstName: string | null; lastName: string | null; companyName: string | null };
  responsible: { id: string; firstName: string; lastName: string };
};

type ClientOpt = { id: string; firstName: string | null; lastName: string | null; companyName: string | null };
type UserOpt = { id: string; firstName: string; lastName: string };
type PropertyOpt = { id: string; title: string | null; addressLine: string };
type ProjectOpt = { id: string; name: string };
type StageOpt = { id: string; name: string; dealType: string };

function clientLabel(c: ClientOpt) {
  if (c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id.slice(0, 8);
}

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function DealsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [fResponsible, setFResponsible] = useState('');
  const [fStage, setFStage] = useState('');
  const [fType, setFType] = useState('');
  const [fOpenOnly, setFOpenOnly] = useState(true);
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [properties, setProperties] = useState<PropertyOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [stages, setStages] = useState<StageOpt[]>([]);

  const [formType, setFormType] = useState('SALE');
  const [formClientId, setFormClientId] = useState('');
  const [formStageId, setFormStageId] = useState('');
  const [formResponsibleId, setFormResponsibleId] = useState('');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    const qs = buildQuery({
      responsibleUserId: fResponsible || undefined,
      dealStageId: fStage || undefined,
      type: fType || undefined,
      updatedFrom: fFrom || undefined,
      updatedTo: fTo || undefined,
      openOnly: fOpenOnly ? 'true' : undefined,
    });
    const list = await apiFetch<Row[]>(`/api/deals${qs}`);
    setRows(list);
  }, [fResponsible, fStage, fType, fFrom, fTo, fOpenOnly]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadList();
        if (cancelled) return;
        setError(null);
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
      try {
        const [st, cl, pr] = await Promise.all([
          apiFetch<StageOpt[]>('/api/deal-stages'),
          can(user, PermissionKeys.CLIENTS_READ) ? apiFetch<ClientOpt[]>('/api/clients') : Promise.resolve([]),
          can(user, PermissionKeys.PROPERTIES_READ) ? apiFetch<PropertyOpt[]>('/api/properties') : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setStages(st);
        setClients(cl);
        setProperties(pr);
        if (can(user, PermissionKeys.CONSTRUCTION_READ)) {
          const pj = await apiFetch<ProjectOpt[]>('/api/construction/projects');
          if (!cancelled) setProjects(pj);
        }
        if (can(user, PermissionKeys.USERS_LIST)) {
          const us = await apiFetch<{ id: string; firstName: string; lastName: string }[]>('/api/users');
          if (!cancelled) setUsers(us);
        } else if (user) {
          setUsers([{ id: user.id, firstName: user.firstName, lastName: user.lastName }]);
        }
      } catch {
        /* ignore dropdown errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const stagesForForm = useMemo(
    () => stages.filter((s) => s.dealType === formType).sort((a, b) => a.name.localeCompare(b.name)),
    [stages, formType],
  );

  useEffect(() => {
    if (!formStageId || !stagesForForm.some((s) => s.id === formStageId)) {
      setFormStageId(stagesForForm[0]?.id ?? '');
    }
  }, [formType, stagesForForm, formStageId]);

  function openCreate() {
    setEditId(null);
    setFormType('SALE');
    setFormClientId(clients[0]?.id ?? '');
    setFormResponsibleId(user?.id ?? '');
    setFormPropertyId('');
    setFormProjectId('');
    setFormAmount('');
    setFormNotes('');
    setModal(true);
  }

  async function openEdit(id: string) {
    try {
      const d = await apiFetch<{
        id: string;
        type: string;
        dealStageId: string;
        clientId: string;
        responsibleUserId: string;
        propertyId: string | null;
        constructionProjectId: string | null;
        amount: string | null;
        notes: string | null;
      }>(`/api/deals/${id}`);
      setEditId(id);
      setFormType(d.type);
      setFormClientId(d.clientId);
      setFormStageId(d.dealStageId);
      setFormResponsibleId(d.responsibleUserId);
      setFormPropertyId(d.propertyId ?? '');
      setFormProjectId(d.constructionProjectId ?? '');
      setFormAmount(d.amount ?? '');
      setFormNotes(d.notes ?? '');
      setModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formClientId) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        type: formType,
        clientId: formClientId,
        dealStageId: formStageId || undefined,
        responsibleUserId: formResponsibleId || undefined,
        propertyId: formPropertyId || undefined,
        constructionProjectId: formProjectId || undefined,
        amount: formAmount ? Number(formAmount) : undefined,
        notes: formNotes || undefined,
      };
      if (editId) {
        await apiFetch(`/api/deals/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/deals', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  function clientName(c: Row['client']) {
    if (c.companyName) return c.companyName;
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
  }

  const canWrite = can(user, PermissionKeys.DEALS_WRITE);

  return (
    <div>
      <h1 className="page-title">Сделки</h1>
      <p className="page-sub">Продажа, аренда, строительство — воронки по этапам.</p>

      <div
        className="card"
        style={{ marginBottom: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
      >
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Ответственный
          <select value={fResponsible} onChange={(e) => setFResponsible(e.target.value)} style={input}>
            <option value="">Все</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Этап
          <select value={fStage} onChange={(e) => setFStage(e.target.value)} style={input}>
            <option value="">Все</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.dealType}] {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Тип
          <select value={fType} onChange={(e) => setFType(e.target.value)} style={input}>
            <option value="">Все</option>
            <option value="SALE">SALE</option>
            <option value="RENT">RENT</option>
            <option value="CONSTRUCTION">CONSTRUCTION</option>
          </select>
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Обновлено с
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          по
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} style={input} />
        </label>
        <label
          style={{
            fontSize: '0.78rem',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            paddingBottom: 4,
          }}
        >
          <input type="checkbox" checked={fOpenOnly} onChange={(e) => setFOpenOnly(e.target.checked)} />
          Только открытые
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        {canWrite ? (
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
            Новая сделка
          </button>
        ) : null}
      </div>

      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {!rows && !error ? <div className="empty">Загрузка…</div> : null}
      {rows?.length === 0 ? <div className="empty">Нет сделок.</div> : null}
      {rows && rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Тип</th>
                <th>Этап</th>
                <th>Сумма</th>
                <th>Ответственный</th>
                {canWrite ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} onClick={() => navigate(`/deals/${d.id}`)} style={{ cursor: 'pointer' }}>
                  <td>{clientName(d.client)}</td>
                  <td>
                    <span className="badge badge-accent">{d.type}</span>
                  </td>
                  <td>{d.dealStage?.name ?? '—'}</td>
                  <td>{d.amount ?? '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>
                    {d.responsible.firstName} {d.responsible.lastName}
                  </td>
                  {canWrite ? (
                    <td>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openEdit(d.id);
                        }}
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

      <Modal open={modal} title={editId ? 'Редактирование сделки' : 'Новая сделка'} onClose={() => setModal(false)}>
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Тип сделки
            <select value={formType} onChange={(e) => setFormType(e.target.value)} style={input} required>
              <option value="SALE">Продажа</option>
              <option value="RENT">Аренда</option>
              <option value="CONSTRUCTION">Строительство</option>
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Клиент
            <select value={formClientId} onChange={(e) => setFormClientId(e.target.value)} style={input} required>
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Этап воронки
            <select value={formStageId} onChange={(e) => setFormStageId(e.target.value)} style={input} required>
              {stagesForForm.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Ответственный
            <select value={formResponsibleId} onChange={(e) => setFormResponsibleId(e.target.value)} style={input}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Объект (необязательно)
            <select value={formPropertyId} onChange={(e) => setFormPropertyId(e.target.value)} style={input}>
              <option value="">—</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title ?? p.addressLine}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Проект стройки (необязательно)
            <select value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} style={input}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Сумма
            <input value={formAmount} onChange={(e) => setFormAmount(e.target.value)} style={input} inputMode="decimal" />
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
