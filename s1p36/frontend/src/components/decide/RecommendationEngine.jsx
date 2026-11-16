import { useDataset } from '../../hooks/useDataset.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const LEVELS = [
  ['P1_URGENT', 'Urgent'],
  ['P2_HIGH', 'High'],
  ['P3_MEDIUM', 'Medium'],
  ['P4_ROUTINE', 'Routine'],
];

export function RecommendationEngine() {
  const query = useDataset('recommendations');
  if (query.loading || query.error) {
    return <DataState query={query} label="recommendations" skeleton={<SkeletonCard count={3} height={160} />} />;
  }
  const items = query.data;
  if (items.length === 0) return <p className="card">No recommendations were produced for this run.</p>;
  return (
    <div>
      {LEVELS.map(([key, name]) => {
        const group = items.filter(i => i.priority === key);
        if (group.length === 0) return null;
        return (
          <section key={key} aria-label={name + ' priority'}>
            <h2 className="group-title">{name + ' (' + group.length + ')'}</h2>
            <div className="grid chart-grid">
              {group.map(r => (
                <article className="card" key={r.id}>
                  <p className="item-title">{r.title}</p>
                  {r.action && r.action !== r.title ? <p>{r.action}</p> : null}
                  {r.evidence ? <p className="muted">{r.evidence}</p> : null}
                  <div className="metric-row">
                    {r.impact ? <span>{'Impact: ' + r.impact}</span> : null}
                    {r.when ? <span>{'When: ' + r.when}</span> : null}
                    {r.count !== null ? <span>{'Records affected: ' + r.count}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
