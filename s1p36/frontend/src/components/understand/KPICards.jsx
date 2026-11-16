import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { Icon } from '../shared/Icon.jsx';

export function KPICards() {
  const query = useDataset('kpis');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="key numbers" skeleton={<SkeletonCard count={4} height={112} />} />;
  }
  const items = query.data;
  return (
    <section className="grid" aria-label="Key numbers">
      {items.map(k => (
        <article className="card" key={k.key}>
          <div className="kpi-label">{k.label}</div>
          <div className="kpi-value">{fmt.value(k.value, k.format)}</div>
          {k.trend !== null ? (
            <span className={k.trend >= 0 ? 'kpi-trend up' : 'kpi-trend down'}>
              <Icon name={k.trend >= 0 ? 'arrowUp' : 'arrowDown'} />
              {(k.trend > 0 ? '+' : '') + fmt.value(k.trend, 'percent') + ' vs previous period'}
            </span>
          ) : null}
          {k.note ? <p className="muted">{k.note}</p> : null}
        </article>
      ))}
    </section>
  );
}
