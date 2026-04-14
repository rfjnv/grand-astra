import { useParams } from 'react-router-dom';

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header className="card" style={{ display: 'grid', gap: 10 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Сделка {id ?? '—'}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-accent">TYPE: —</span>
          <span className="badge">STATUS: —</span>
        </div>
      </header>

      <section className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: 4 }}>Клиент</div>
          <div>—</div>
        </div>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: 4 }}>Сумма</div>
          <div>—</div>
        </div>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: 4 }}>Ответственный</div>
          <div>—</div>
        </div>
      </section>

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
