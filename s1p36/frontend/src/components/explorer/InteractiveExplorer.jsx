import { useId, useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { useExplorer } from '../../context/ExplorerContext.jsx';
import { aggregate, totals } from '../../utils/cube.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ChartPanel } from '../understand/ChartPanel.jsx';
import { FilterBar } from './FilterBar.jsx';
import { DrillDownPanel } from './DrillDownPanel.jsx';

function ExplorerView({ cube }) {
  const fmt = useFormat();
  const ex = useExplorer();
  const groupId = useId();
  const [drill, setDrill] = useState(null);
  const [groupDim, setGroupDim] = useState(cube.dimensions.length ? cube.dimensions[0].key : '');
  const [sort, setSort] = useState({ key: '', dir: 'desc' });
  const [copyState, setCopyState] = useState('');
  const metrics = cube.metrics;
  const metric = metrics.find(m => m.key === ex.metricKey) || metrics[0];
  const filters = ex.filters;
  const times = useMemo(() => [...new Set(cube.rows.map(r => r.t))].sort(), [cube]);
  const timeRows = useMemo(() => aggregate(cube, filters, '_time', metric.key), [cube, filters, metric]);
  const tableMetrics = metrics.slice(0, 6);

  const tableRows = useMemo(() => {
    if (!groupDim) return [];
    const base = aggregate(cube, filters, groupDim, metric.key, groupDim);
    const maps = tableMetrics.map(m => [m.key, new Map(aggregate(cube, filters, groupDim, m.key, groupDim).map(r => [r.label, r.value]))]);
    const rows = base.map(r => {
      const row = { label: r.label };
      for (const [key, map] of maps) row[key] = map.has(r.label) ? map.get(r.label) : 0;
      return row;
    });
    if (sort.key) {
      rows.sort((a, b) => {
        const cmp = sort.key === 'label' ? String(a.label).localeCompare(String(b.label)) : a[sort.key] - b[sort.key];
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows.slice(0, 50);
  }, [cube, filters, metric, groupDim, sort]);

  const onSort = key => setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));

  const onCopy = async () => {
    const lines = ['Summary of ' + metric.label];
    const active = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => k.replace(/^_/, '') + ': ' + v);
    lines.push(active.length ? 'Filters: ' + active.join(', ') : 'Filters: none');
    for (const m of metrics) lines.push(m.label + ': ' + fmt.value(totals(cube, filters, m.key), m.format));
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopyState('Copied');
    } catch {
      setCopyState('Copy not available');
    }
    window.setTimeout(() => setCopyState(''), 2000);
  };

  const timeChart = {
    id: 'explorer-time', title: metric.label + ' over time', question: 'How does this measure change from period to period?',
    type: 'line', outcome: 'understand', xLabel: 'Period', yLabel: metric.label, rows: timeRows,
  };
  const drillScope = drill ? { ...filters, [drill.dim]: drill.value } : null;
  const otherDim = drill ? cube.dimensions.find(d => d.key !== drill.dim) : null;
  const dimLabel = key => {
    const d = cube.dimensions.find(x => x.key === key);
    return d ? d.label : key;
  };

  return (
    <div>
      <FilterBar cube={cube} times={times} metricKey={metric.key} copyState={copyState} onCopy={onCopy} />
      <div className="stack">
        {timeRows.length > 0 ? <ChartPanel chart={timeChart} valueFormat={metric.format} /> : <p className="card">No data matches these filters.</p>}
        <div className="two-col">
          {cube.dimensions.slice(0, 4).map(d => {
            const rows = aggregate(cube, filters, d.key, metric.key, d.key);
            if (rows.length === 0) return null;
            const chart = {
              id: 'explorer-' + d.key, title: metric.label + ' by ' + d.label, question: 'Click a bar to filter everything else.',
              type: 'bar', outcome: 'understand', xLabel: d.label, yLabel: metric.label, rows,
            };
            return <ChartPanel key={d.key} chart={chart} valueFormat={metric.format} selected={filters[d.key]} onSelect={label => ex.setFilter(d.key, label)} />;
          })}
        </div>
        {cube.dimensions.length > 0 ? (
          <section>
            <div className="field">
              <label htmlFor={groupId}>Group the table by</label>
              <select id={groupId} value={groupDim} onChange={e => setGroupDim(e.target.value)}>
                {cube.dimensions.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col"><button type="button" onClick={() => onSort('label')}>{dimLabel(groupDim)}</button></th>
                    {tableMetrics.map(m => <th key={m.key} scope="col"><button type="button" onClick={() => onSort(m.key)}>{m.label}</button></th>)}
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(r => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      {tableMetrics.map(m => <td key={m.key}>{fmt.value(r[m.key], m.format)}</td>)}
                      <td><button type="button" className="btn-secondary" onClick={() => setDrill({ dim: groupDim, value: r.label })}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <p className="muted">Figures are aggregated; no individual records are shown.</p>
      </div>
      {drill ? (
        <DrillDownPanel title={drill.value} onClose={() => setDrill(null)}>
          <p className="muted">{dimLabel(drill.dim)}</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Measure</th><th scope="col">Total</th></tr></thead>
              <tbody>
                {metrics.map(m => <tr key={m.key}><td>{m.label}</td><td>{fmt.value(totals(cube, drillScope, m.key), m.format)}</td></tr>)}
              </tbody>
            </table>
          </div>
          {otherDim ? (
            <div>
              <h3>{'Top ' + otherDim.label + ' for ' + metric.label}</h3>
              <ul>
                {aggregate(cube, drillScope, otherDim.key, metric.key).slice(0, 5).map(r => (
                  <li key={r.label}>{r.label + ': ' + fmt.value(r.value, metric.format)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="muted">Figures are aggregated; no individual records are shown.</p>
        </DrillDownPanel>
      ) : null}
    </div>
  );
}

export function InteractiveExplorer() {
  const query = useDataset('explorer');
  if (query.loading || query.error) {
    return <DataState query={query} label="explorer data" skeleton={<SkeletonCard count={3} height={160} />} />;
  }
  return <ExplorerView cube={query.data} />;
}
