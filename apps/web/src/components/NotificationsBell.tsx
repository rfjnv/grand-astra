import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import { can, PermissionKeys } from '../auth/permissionKeys';
import { useAuth } from '../auth/AuthContext';

type NotificationRow = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!can(user, PermissionKeys.NOTIFICATIONS_READ)) return;
    const list = await apiFetch<NotificationRow[]>('/api/notifications?take=30');
    setItems(list);
  }, [user]);

  useEffect(() => {
    if (!open || !can(user, PermissionKeys.NOTIFICATIONS_READ)) return;
    void load();
  }, [open, user, load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!can(user, PermissionKeys.NOTIFICATIONS_READ)) return null;

  const unread = items?.filter((n) => !n.isRead).length ?? 0;

  async function markRead(id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    void load();
  }

  async function markAll() {
    await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    void load();
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'relative',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--surface)',
          color: 'var(--text)',
          padding: '0.35rem 0.55rem',
          fontSize: '0.82rem',
        }}
      >
        Уведомления
        {unread > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: 'var(--danger)',
              color: 'white',
              borderRadius: 999,
              fontSize: '0.65rem',
              minWidth: 18,
              height: 18,
              display: 'grid',
              placeItems: 'center',
              padding: '0 4px',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="card"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 340,
            maxHeight: 400,
            overflow: 'auto',
            zIndex: 50,
            padding: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Центр уведомлений</span>
            <button
              type="button"
              onClick={() => void markAll()}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Прочитать все
            </button>
          </div>
          {!items ? <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Загрузка…</div> : null}
          {items?.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Пусто</div> : null}
          {items?.map((n) => (
            <div
              key={n.id}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
                opacity: n.isRead ? 0.65 : 1,
              }}
            >
              <div style={{ fontSize: '0.82rem' }}>{n.message}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                {new Date(n.createdAt).toLocaleString('ru-RU')}
              </div>
              {!n.isRead ? (
                <button
                  type="button"
                  onClick={() => void markRead(n.id)}
                  style={{
                    marginTop: 6,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--accent)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Прочитано
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
