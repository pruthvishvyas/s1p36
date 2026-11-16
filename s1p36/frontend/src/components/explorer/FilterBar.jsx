import { useId } from 'react';
import { useExplorer } from '../../context/ExplorerContext.jsx';

export function FilterBar({ cube, times, metricKey, copyState, onCopy }) {
  const ex = useExplorer();
  const base = useId();
  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      <div className="field">
        <label htmlFor={base + '-metric'}>Measure</label>
        <select id={base + '-metric'} value={metricKey} onChange={e => ex.setMetricKey(e.target.value)}>
          {cube.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={base + '-from'}>From</label>
        <select id={base + '-from'} value={ex.filters._from || ''} onChange={e => ex.setFilter('_from', e.target.value)}>
          <option value="">Start</option>
          {times.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={base + '-to'}>To</label>
        <select id={base + '-to'} value={ex.filters._to || ''} onChange={e => ex.setFilter('_to', e.target.value)}>
          <option value="">End</option>
          {times.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {cube.dimensions.map(d => (
        <div className="field" key={d.key}>
          <label htmlFor={base + '-' + d.key}>{d.label}</label>
          <select id={base + '-' + d.key} value={ex.filters[d.key] || ''} onChange={e => ex.setFilter(d.key, e.target.value)}>
            <option value="">All</option>
            {d.values.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={ex.clearFilters} disabled={ex.activeCount === 0}>
        {'Clear filters (' + ex.activeCount + ')'}
      </button>
      <button type="button" className="btn-secondary" onClick={onCopy}>{copyState || 'Copy summary'}</button>
    </div>
  );
}
