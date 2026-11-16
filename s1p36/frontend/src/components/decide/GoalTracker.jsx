import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useContract } from '../../hooks/useContract.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { formatWithUnit } from '../../utils/formatters.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ProgressBar } from '../shared/ProgressBar.jsx';

function GoalView({ goals, actuals, clientId }) {
  const fmt = useFormat();
  const storeKey = 'goals:' + clientId;
  const [targets, setTargets] = useState(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const onChange = (key, value) => {
    const next = { ...targets, [key]: value };
    setTargets(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch { /* storage blocked: the value stays for this visit only */ }
  };
  if (goals.length === 0) return <p className="card">No goals are configured for this project.</p>;
  return (
    <div className="grid chart-grid">
      {goals.map(g => {
        const editable = g.clientSets || g.target === null;
        const entered = targets[g.key];
        const target = editable && entered !== undefined && entered !== '' ? Number(entered) : g.target;
        const match = actuals.find(a => a.key === g.key) || actuals.find(a => a.label === g.label);
        const actual = match ? match.actual : null;
        const pct = actual !== null && Number.isFinite(target) && target > 0 ? (actual / target) * 100 : null;
        return (
          <article className="card" key={g.key}>
            <h3>{g.label}</h3>
            {g.description ? <p className="muted">{g.description}</p> : null}
            {editable ? (
              <div className="field">
                <label htmlFor={'goal-' + g.key}>{'Your target' + (g.unit ? ' (' + g.unit + ')' : '')}</label>
                <input id={'goal-' + g.key} type="number" inputMode="decimal" value={entered === undefined ? '' : entered} onChange={e => onChange(g.key, e.target.value)} />
                <p className="field-help">Saved on this device only</p>
              </div>
            ) : (
              <p>{'Target: ' + formatWithUnit(fmt, g.target, g.unit)}</p>
            )}
            {actual !== null ? <p>{'Actual: ' + formatWithUnit(fmt, actual, g.unit)}</p> : null}
            {pct !== null ? (
              <div>
                <ProgressBar pct={pct} />
                <p className="muted">{fmt.value(pct, 'percent') + ' of target'}</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function GoalTracker() {
  const goals = useDataset('goals');
  const progress = useDataset('goalProgress');
  const contract = useContract();
  if (goals.loading || goals.error) {
    return <DataState query={goals} label="goals" skeleton={<SkeletonCard count={3} height={160} />} />;
  }
  const clientId = contract.data ? contract.data.project.clientId : 'project';
  return <GoalView goals={goals.data} actuals={progress.data || []} clientId={clientId} />;
}
