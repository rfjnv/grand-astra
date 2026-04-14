export function SettingsPage() {
  return (
    <div>
      <h1 className="page-title">Настройки</h1>
      <p className="page-sub">
        Здесь появятся параметры филиалов, валюты по умолчанию, шаблоны договоров и интеграции.
      </p>
      <div className="card" style={{ maxWidth: 560, lineHeight: 1.55, color: 'var(--muted)' }}>
        Сейчас конфигурация через переменные окружения API (<code style={{ color: 'var(--text)' }}>JWT_SECRET</code>,{' '}
        <code style={{ color: 'var(--text)' }}>DATABASE_URL</code>). Для PostgreSQL укажите строку подключения и
        выполните миграции Prisma.
      </div>
    </div>
  );
}
