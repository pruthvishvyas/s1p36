import { useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const PAGE_SIZE = 25;
const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'metric', label: 'Measure' },
  { key: 'value', label: 'Value' },
  { key: 'expected', label: 'Expected' },
  { key: 'score', label: 'Score' },
  { key: 'reason', label: 'Why it was flagged' },
];

function AnomalyView({ data }) {
  const fmt = useFormat();
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' });
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const copy = [...data.items];
    copy.sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const onSort = key => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(0);
  };
  const dash = v => (v === null ? '-' : fmt.value(v, 'decimal'));
  return (
    <div className="stack">
      <div className="card">
        <p>{fmt.value(data.total, 'integer') + ' unusual records found' + (data.rate !== null ? ', ' + fmt.value(data.rate, 'percent') + ' of all records.' : '.')}</p>
        {data.method ? <p className="muted">{'Method: ' + data.method}</p> : null}
      </div>
      {rows.length === 0 ? <p className="card">No unusual records were flagged.</p> : (
        <div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {COLUMNS.map(c => (
                    <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => onSort(c.key)}>{c.label + (sort.key === c.key ? (sort.dir === 'asc' ? ' (up)' : ' (down)') : '')}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id}>
                    <td>{r.date === null ? '-' : fmt.date(r.date)}</td>
                    <td>{r.metric || '-'}</td>
                    <td>{dash(r.value)}</td>
                    <td>{dash(r.expected)}</td>
                    <td>{dash(r.score)}</td>
                    <td>{r.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" className="btn-secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
            <span className="muted">{'Page ' + (current + 1) + ' of ' + pages}</span>
            <button type="button" className="btn-secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnomalyTable() {
  const query = useDataset('anomalies');
  if (query.loading || query.error) {
    return <DataState query={query} label="anomalies" skeleton={<SkeletonCard count={2} height={160} />} />;
  }
  return <AnomalyView data={query.data} />;
}
