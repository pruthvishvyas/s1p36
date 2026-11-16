import { useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { humanize } from '../../utils/adapters.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ProgressBar } from '../shared/ProgressBar.jsx';
import { DrillDownPanel } from '../explorer/DrillDownPanel.jsx';
import { ChartPanel } from './ChartPanel.jsx';

function SegmentView({ data }) {
  const fmt = useFormat();
  const [open, setOpen] = useState(null);
  const chart = useMemo(() => ({
    id: 'segment-sizes', title: 'Segment sizes', type: 'bar', question: 'How large is each segment?',
    outcome: 'understand', xLabel: 'Segment', yLabel: 'Size',
    rows: data.items.map(s => ({ label: s.name, value: s.size })),
  }), [data]);
  return (
    <div className="stack">
      {data.method ? <p className="muted">{'Method: ' + data.method}</p> : null}
      <ChartPanel chart={chart} valueFormat="integer" />
      <section className="grid" aria-label="Segments">
        {data.items.map(s => (
          <button type="button" key={s.id} className="card card-button" onClick={() => setOpen(s)}>
            <h3>{s.name}</h3>
            <p className="muted">{fmt.value(s.size, 'integer') + ' records, ' + fmt.value(s.share, 'percent')}</p>
            <ProgressBar pct={s.share} />
            <div className="metric-row">
              {Object.entries(s.summary).slice(0, 3).map(([k, v]) => <span key={k}>{humanize(k) + ': ' + fmt.value(v, 'decimal')}</span>)}
            </div>
          </button>
        ))}
      </section>
      {open ? (
        <DrillDownPanel title={open.name} onClose={() => setOpen(null)}>
          <p>{open.description || 'No description was provided for this segment.'}</p>
          <p className="muted">{fmt.value(open.size, 'integer') + ' records, ' + fmt.value(open.share, 'percent') + ' of the total'}</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Measure</th><th scope="col">Value</th></tr></thead>
              <tbody>
                {Object.entries(open.summary).map(([k, v]) => <tr key={k}><td>{humanize(k)}</td><td>{fmt.value(v, 'decimal')}</td></tr>)}
              </tbody>
            </table>
          </div>
        </DrillDownPanel>
      ) : null}
    </div>
  );
}

export function SegmentExplorer() {
  const query = useDataset('segments');
  if (query.loading || query.error) {
    return <DataState query={query} label="segments" skeleton={<SkeletonCard count={3} height={160} />} />;
  }
  return <SegmentView data={query.data} />;
}
