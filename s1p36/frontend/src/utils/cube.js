function finalize(metric, bucket, metricsByKey) {
  const cell = bucket[metric.key] || { sum: 0, n: 0 };
  switch (metric.agg) {
    case 'mean': return cell.n ? cell.sum / cell.n : 0;
    case 'rate': return cell.n ? (cell.sum / cell.n) * 100 : 0;
    case 'count': return cell.n;
    case 'ratio': {
      const num = bucket[metric.num] ? bucket[metric.num].sum : 0;
      const den = bucket[metric.den] ? bucket[metric.den].sum : 0;
      const ratio = den ? num / den : 0;
      return metricsByKey[metric.key] && metricsByKey[metric.key].format === 'percent' ? ratio * 100 : ratio;
    }
    default: return cell.sum;
  }
}

// filters: { <dimensionKey>: value, _from: 'YYYY-MM', _to: 'YYYY-MM' }
// groupBy: a dimension key, '_time' or '_all'; skipDim: ignore that dimension's own filter (cross-filter behaviour)
export function aggregate(cube, filters, groupBy, metricKey, skipDim) {
  const metricsByKey = Object.fromEntries(cube.metrics.map(m => [m.key, m]));
  const metric = metricsByKey[metricKey];
  if (!metric) return [];
  const buckets = new Map();
  for (const row of cube.rows) {
    let keep = true;
    for (const [dim, value] of Object.entries(filters)) {
      if (dim === '_from' || dim === '_to' || dim === skipDim) continue;
      if (value && row.d[dim] !== value) { keep = false; break; }
    }
    if (keep && filters._from && row.t < filters._from) keep = false;
    if (keep && filters._to && row.t > filters._to) keep = false;
    if (!keep) continue;
    let label;
    if (groupBy === '_time') label = row.t;
    else if (groupBy === '_all') label = 'All';
    else label = row.d[groupBy] === undefined ? 'Unknown' : row.d[groupBy];
    const bucket = buckets.get(label) || {};
    for (const [key, cell] of Object.entries(row.m)) {
      const acc = bucket[key] || { sum: 0, n: 0 };
      acc.sum += cell.sum;
      acc.n += cell.n;
      bucket[key] = acc;
    }
    buckets.set(label, bucket);
  }
  const out = [...buckets.entries()].map(([label, bucket]) => ({ label, value: finalize(metric, bucket, metricsByKey) }));
  return groupBy === '_time' ? out.sort((a, b) => (a.label < b.label ? -1 : 1)) : out.sort((a, b) => b.value - a.value);
}

export function totals(cube, filters, metricKey) {
  const rows = aggregate(cube, filters, '_all', metricKey);
  return rows.length ? rows[0].value : 0;
}
