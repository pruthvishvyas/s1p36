import { useContract } from '../../hooks/useContract.js';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DATASETS } from '../../utils/datasets.js';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

function DatasetRow({ name }) {
  const query = useDataset(name);
  let state = 'Loaded';
  let detail = '';
  if (query.loading) state = 'Loading';
  else if (query.error) {
    const kind = query.error.kind;
    state = kind === 'skipped' ? 'Skipped' : kind === 'missing' || kind === 'empty' ? 'Missing' : 'Invalid';
    detail = query.error.message;
  }
  return <tr><td>{name}</td><td>{state}</td><td>{detail}</td></tr>;
}

function PredictMode() {
  const scorer = useDataset('scorer');
  const lookup = useDataset('forecastLookup');
  const forecast = useDataset('forecast');
  if (scorer.loading || lookup.loading || forecast.loading) return <p className="muted">Checking the Predict page...</p>;
  let text;
  if (scorer.data) text = 'Model scoring (' + (scorer.data.type === 'linear' ? 'linear' : 'nearest neighbour') + ')';
  else if (lookup.data) text = 'Lookup table';
  else if (forecast.data && forecast.data.forecast.length > 0) text = 'Forecast period';
  else {
    const reasons = [scorer.error, lookup.error, forecast.error].filter(Boolean).map(e => e.message);
    text = 'Unavailable. ' + reasons.join(' ');
  }
  return <p>{'Predict page mode: ' + text}</p>;
}

export function DataHealth() {
  const contract = useContract();
  const summary = useDataset('summary');
  const runLog = useDataset('runLog');
  const fmt = useFormat();
  if (contract.loading || summary.loading) return <SkeletonCard count={2} height={112} />;
  const s = summary.data;
  const lastRun = s && s.lastRun ? s.lastRun : '';
  const stages = runLog.data && runLog.data.runs.length > 0 ? runLog.data.runs[0].stages : [];
  return (
    <div className="stack">
      <section className="card">
        <h2>Last run</h2>
        {lastRun ? <p>{fmt.ago(lastRun) + ' (' + lastRun + ')'}</p> : <p className="muted">No run time was recorded.</p>}
        {s ? (
          <div className="metric-row">
            <span>{'Source: ' + (s.source || 'unknown')}</span>
            <span>{'Rows: ' + (s.rows === null ? 'unknown' : fmt.value(s.rows, 'integer'))}</span>
            <span>{'Date range: ' + (s.dateRange.start ? s.dateRange.start + ' to ' + s.dateRange.end : 'unknown')}</span>
          </div>
        ) : <p className="muted">{summary.error ? summary.error.message : ''}</p>}
        {contract.data ? <p className="muted">{'Contract schema version ' + contract.data.schemaVersion}</p> : <p className="muted">The project description file is not available.</p>}
      </section>
      <section className="card">
        <h2>Prediction</h2>
        <PredictMode />
      </section>
      <section>
        <h2 className="group-title">Run steps</h2>
        {stages.length === 0 ? <p className="muted">No run steps were recorded.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Step</th><th scope="col">Status</th><th scope="col">Seconds</th><th scope="col">Reason</th></tr></thead>
              <tbody>
                {stages.map((st, i) => (
                  <tr key={i + '-' + st.name}>
                    <td>{st.name}</td><td>{st.status}</td><td>{st.seconds === null ? '-' : fmt.value(st.seconds, 'decimal')}</td><td>{st.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section>
        <h2 className="group-title">Data files</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th scope="col">Dataset</th><th scope="col">State</th><th scope="col">Detail</th></tr></thead>
            <tbody>
              {Object.keys(DATASETS).map(name => <DatasetRow key={name} name={name} />)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
