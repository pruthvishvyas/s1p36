import { useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { SeverityBadge } from '../shared/SeverityBadge.jsx';

const LEVELS = [['ALL', 'All'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']];

function InsightView({ items }) {
  const [level, setLevel] = useState('ALL');
  const counts = useMemo(() => {
    const c = { ALL: items.length, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const i of items) c[i.severity] += 1;
    return c;
  }, [items]);
  const shown = level === 'ALL' ? items : items.filter(i => i.severity === level);
  return (
    <div>
      <div className="chips" role="group" aria-label="Filter by severity">
        {LEVELS.map(([key, name]) => (
          <button type="button" key={key} className="chip" aria-pressed={level === key} onClick={() => setLevel(key)}>
            {name + ' (' + counts[key] + ')'}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="card">No insights at this level.</p> : (
        <div className="grid chart-grid">
          {shown.map(i => (
            <article className="card" key={i.id}>
              <SeverityBadge level={i.severity} />
              {i.category ? <p className="item-label">{i.category}</p> : null}
              <p className="item-title">{i.finding}</p>
              {i.evidence ? <p className="muted">{i.evidence}</p> : null}
              {i.action ? (
                <div>
                  <p className="item-label">What to do this week</p>
                  <p>{i.action}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightCards() {
  const query = useDataset('insights');
  if (query.loading || query.error) {
    return <DataState query={query} label="insights" skeleton={<SkeletonCard count={3} height={160} />} />;
  }
  if (query.data.length === 0) return <p className="card">No insights were produced for this run.</p>;
  return <InsightView items={query.data} />;
}
