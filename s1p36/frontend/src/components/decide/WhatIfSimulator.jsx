import { useId, useState } from 'react';
import { useDataset, useDataFile } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { adaptSimulation } from '../../utils/adapters.js';
import { simulationPath } from '../../utils/datasets.js';
import { interpolate } from '../../utils/sim.js';
import { formatWithUnit } from '../../utils/formatters.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

function SimulationBody({ sim }) {
  const fmt = useFormat();
  const id = useId();
  const v = sim.variable;
  const [x, setX] = useState(v.default);
  const baseline = interpolate(sim.table, v.default) || {};
  const scenario = interpolate(sim.table, x) || {};
  return (
    <div className="stack">
      {sim.description ? <p>{sim.description}</p> : null}
      <div className="card">
        <div className="field">
          <label htmlFor={id}>{v.label + ': ' + formatWithUnit(fmt, x, v.format === 'decimal' ? v.unit : v.format)}</label>
          <input id={id} type="range" min={v.min} max={v.max} step={v.step} value={x} onChange={e => setX(Number(e.target.value))} />
          <p className="field-help">{'Baseline: ' + formatWithUnit(fmt, v.default, v.format === 'decimal' ? v.unit : v.format) + '. Range ' + v.min + ' to ' + v.max + '.'}</p>
        </div>
      </div>
      <div className="grid">
        {sim.outputs.map(o => {
          const base = baseline[o.key];
          const now = scenario[o.key];
          const diff = base === undefined || now === undefined ? null : now - base;
          return (
            <article className="card" key={o.key}>
              <div className="kpi-label">{o.label}</div>
              <div className="kpi-value">{now === undefined ? '-' : fmt.value(now, o.format)}</div>
              <p className="muted">{'Baseline ' + (base === undefined ? '-' : fmt.value(base, o.format))}</p>
              {diff !== null ? (
                <p className={diff >= 0 ? 'kpi-trend up' : 'kpi-trend down'}>{'Change: ' + (diff > 0 ? '+' : '') + fmt.value(diff, o.format)}</p>
              ) : null}
            </article>
          );
        })}
      </div>
      {sim.assumptions.length > 0 ? (
        <div className="card">
          <h3>Assumptions</h3>
          <ul>{sim.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

function SimulationView({ item }) {
  const query = useDataFile(simulationPath(item), adaptSimulation);
  if (query.loading || query.error) {
    return <DataState query={query} label="simulation" skeleton={<SkeletonCard count={2} height={112} />} />;
  }
  return <SimulationBody sim={query.data} />;
}

function SimulationPicker({ items }) {
  const id = useId();
  const [chosen, setChosen] = useState(items.length ? items[0].id : '');
  if (items.length === 0) return <p className="card">No simulations were produced for this run.</p>;
  const current = items.find(i => i.id === chosen) || items[0];
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor={id}>Scenario</label>
        <select id={id} value={current.id} onChange={e => setChosen(e.target.value)}>
          {items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </div>
      <SimulationView key={current.id} item={current} />
    </div>
  );
}

export function WhatIfSimulator() {
  const index = useDataset('simulations');
  if (index.loading || index.error) {
    return <DataState query={index} label="simulations" skeleton={<SkeletonCard count={2} height={112} />} />;
  }
  return <SimulationPicker items={index.data} />;
}
