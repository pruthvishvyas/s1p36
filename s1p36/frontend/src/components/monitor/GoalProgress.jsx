import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { formatWithUnit } from '../../utils/formatters.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ProgressBar } from '../shared/ProgressBar.jsx';

const STATUS = { on_track: 'On track', at_risk: 'At risk', off_track: 'Off track', no_target: 'No target' };

export function GoalProgress() {
  const query = useDataset('goalProgress');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="goal progress" skeleton={<SkeletonCard count={3} height={140} />} />;
  }
  const items = query.data;
  if (items.length === 0) return <p className="card">No goal progress is available yet.</p>;
  return (
    <div className="grid chart-grid">
      {items.map(g => (
        <article className="card" key={g.id}>
          <h3>{g.label}</h3>
          <p className={'status-' + g.status}>{STATUS[g.status]}</p>
          <ProgressBar pct={g.pct === null ? 0 : g.pct} status={g.status} />
          <div className="metric-row">
            <span>{'Actual: ' + (g.actual === null ? '-' : formatWithUnit(fmt, g.actual, g.unit))}</span>
            <span>{'Target: ' + (g.target === null ? '-' : formatWithUnit(fmt, g.target, g.unit))}</span>
            {g.pct !== null ? <span>{fmt.value(g.pct, 'percent')}</span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
