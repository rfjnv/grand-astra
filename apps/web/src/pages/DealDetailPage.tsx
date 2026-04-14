import { useParams } from 'react-router-dom';

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 className="page-title">Сделка {id ?? ''}</h1>
      <p className="page-sub">Страница сделки в разработке.</p>
    </div>
  );
}
