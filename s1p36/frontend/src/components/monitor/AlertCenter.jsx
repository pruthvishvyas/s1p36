import { useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { SeverityBadge } from '../shared/SeverityBadge.jsx';

const LEVELS = [['ALL', 'All'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']];

function AlertView({ items }) {
  const fmt = useFormat();
  const [level, setLevel] = useState('ALL');
  const counts = useMemo(() => {
    const c = { ALL: items.length, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const a of items) c[a.severity] += 1;
    return c;
  }, [items]);
  const shown = level === 'ALL' ? items : items.filter(a => a.severity === level);
  return (
    <div>
      <div className="chips" role="group" aria-label="Filter by severity">
        {LEVELS.map(([key, name]) => (
          <button type="button" key={key} className="chip" aria-pressed={level === key} onClick={() => setLevel(key)}>
            {name + ' (' + counts[key] + ')'}
          </button>
        ))}
      </div>
      <div className="grid chart-grid">
        {shown.map(a => {
          const since = a.since ? fmt.ago(a.since) : '';
          return (
            <article className="card" key={a.id}>
              <SeverityBadge level={a.severity} />
              <p className="item-title">{a.title}</p>
              {a.message ? <p>{a.message}</p> : null}
              <div className="metric-row">
                {a.value !== null ? <span>{'Value: ' + fmt.value(a.value, 'decimal')}</span> : null}
                {a.threshold !== null ? <span>{'Threshold: ' + fmt.value(a.threshold, 'decimal')}</span> : null}
                {since ? <span>{'Since ' + since}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function AlertCenter() {
  const query = useDataset('alerts');
  if (query.loading || query.error) {
    return <DataState query={query} label="alerts" skeleton={<SkeletonCard count={3} height={140} />} />;
  }
  if (query.data.length === 0) return <p className="card">No active alerts</p>;
  return <AlertView items={query.data} />;
}
