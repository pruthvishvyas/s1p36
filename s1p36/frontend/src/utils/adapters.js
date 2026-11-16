import { DataError } from './errors.js';

const asNumber = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const cleaned = String(v).replace(/[,\s$\u20ac\u00a3\u00a5%]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const asText = (v, fallback = '') => (v === null || v === undefined ? fallback : String(v));
export const humanize = key =>
  asText(key).replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
const listOf = raw => {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return null;
};
const shape = message => new DataError('shape', message);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const PII = /(email|e_mail|phone|mobile|full_name|first_name|last_name|surname)/i;
const SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'];
const PRIORITIES = ['P1_URGENT', 'P2_HIGH', 'P3_MEDIUM', 'P4_ROUTINE'];
const normSeverity = v => {
  const s = asText(v).toUpperCase();
  return SEVERITIES.includes(s) ? s : 'LOW';
};
const normPriority = v => {
  const s = asText(v).toUpperCase();
  return PRIORITIES.find(p => s === p || s.startsWith(p.slice(0, 2))) || 'P4_ROUTINE';
};

function guessFormat(key, value) {
  const k = asText(key).toLowerCase();
  if (/(rate|share|pct|percent|ratio)/.test(k)) return 'percent';
  if (/(revenue|sales|cost|price|mrr|arr|profit|amount|spend|value_total|margin_amt)/.test(k)) return 'currency';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'decimal';
  return 'text';
}

export function adaptContract(raw) {
  if (!isObj(raw)) throw shape('The project description file has an unexpected shape');
  const project = isObj(raw.project) ? raw.project : {};
  if (!asText(project.name) && !asText(project.client_id)) throw shape('The project description has no project name');
  const t = isObj(raw.terminology) ? raw.terminology : {};
  const outcomes = isObj(raw.outcomes) ? raw.outcomes : {};
  return {
    schemaVersion: asText(raw.schema_version, '1'),
    generatedAt: asText(raw.generated_at),
    project: {
      name: asText(project.name) || asText(project.client_id),
      domain: asText(project.domain),
      clientId: asText(project.client_id) || asText(project.name),
      description: asText(project.description),
    },
    terminology: {
      revenue: asText(t.revenue) || 'Revenue',
      customer: asText(t.customer) || 'Customer',
      product: asText(t.product) || 'Product',
      transaction: asText(t.transaction) || 'Transaction',
    },
    source: isObj(raw.source) ? raw.source : {},
    outcomes: {
      understand: isObj(outcomes.understand) ? outcomes.understand : {},
      decide: isObj(outcomes.decide) ? outcomes.decide : {},
      monitor: isObj(outcomes.monitor) ? outcomes.monitor : {},
      meta: isObj(outcomes.meta) ? outcomes.meta : {},
    },
    model: isObj(raw.model) ? raw.model : {},
    forecaster: isObj(raw.forecaster) ? raw.forecaster : {},
    frontend: isObj(raw.frontend) ? raw.frontend : {},
  };
}

export function adaptSummary(raw) {
  if (!isObj(raw)) throw shape('The summary file has an unexpected shape');
  const cur = isObj(raw.currency) ? { code: asText(raw.currency.code), symbol: asText(raw.currency.symbol) } : null;
  const range = isObj(raw.date_range) ? raw.date_range : {};
  return {
    project: asText(raw.project),
    domain: asText(raw.domain),
    description: asText(raw.description),
    lastRun: asText(raw.last_run) || null,
    rows: asNumber(raw.rows),
    dateRange: { start: asText(range.start), end: asText(range.end) },
    currency: cur && (cur.code || cur.symbol) ? cur : null,
    locale: asText(raw.locale) || 'en-US',
    source: asText(raw.source),
  };
}

export function adaptRunLog(raw) {
  const runs = raw && Array.isArray(raw.runs) ? raw.runs : Array.isArray(raw) ? raw : null;
  if (!runs) throw shape('The run log has an unexpected shape');
  return {
    runs: runs.filter(isObj).map(r => ({
      started: asText(r.started),
      finished: asText(r.finished),
      stages: (Array.isArray(r.stages) ? r.stages : []).filter(isObj).map(s => ({
        name: asText(s.name), status: asText(s.status), seconds: asNumber(s.seconds), reason: asText(s.reason),
      })),
    })),
  };
}

export function adaptKpis(raw) {
  let rows = listOf(raw);
  if (!rows && raw && typeof raw === 'object') {
    rows = Object.entries(raw)
      .filter(([k, v]) => !k.startsWith('_') && k !== 'generated_at' && ['number', 'string', 'boolean'].includes(typeof v))
      .map(([key, value]) => ({ key, value }));
  }
  if (!rows) throw shape('The key numbers file has an unexpected shape');
  const out = rows
    .map((k, i) => {
      if (!k || typeof k !== 'object') return null;
      const key = asText(k.key ?? k.id ?? k.label ?? 'kpi_' + i);
      let value = typeof k.value === 'boolean' ? (k.value ? 'Yes' : 'No') : k.value;
      if (value === undefined || value === null) return null;
      let format = k.format || guessFormat(key, value);
      const n = asNumber(value);
      if (format !== 'text' && n === null) format = 'text';
      if (!k.format && format === 'percent' && n !== null && Math.abs(n) <= 1) value = n * 100;
      return { key, label: asText(k.label, humanize(key)), value, format, trend: asNumber(k.trend), note: asText(k.note) };
    })
    .filter(Boolean);
  if (out.length === 0) throw shape('No usable key numbers found');
  return out;
}

export function adaptChart(raw) {
  if (!raw || typeof raw !== 'object') throw shape('A chart file has an unexpected shape');
  const type = asText(raw.type, 'bar').toLowerCase();
  let rows = Array.isArray(raw.data) ? raw.data : null;
  if (!rows && Array.isArray(raw.x) && Array.isArray(raw.y)) {
    if (raw.x.length !== raw.y.length) throw shape('Chart x and y lengths differ');
    rows = raw.x.map((x, i) => ({ label: x, value: raw.y[i] }));
  }
  if (!rows) throw shape('Chart has no data');
  let cleaned;
  if (type === 'scatter') {
    cleaned = rows.map(r => ({ x: asNumber(r && r.x), y: asNumber(r && r.y), label: asText(r && r.label) }))
      .filter(r => r.x !== null && r.y !== null).slice(0, 1500);
  } else if (type === 'heatmap') {
    cleaned = rows.map(r => ({ row: asText(r && r.row), col: asText(r && r.col), value: asNumber(r && r.value) }))
      .filter(r => r.value !== null);
  } else {
    cleaned = rows.map(r => ({ label: asText(r && (r.label ?? r.x)), value: asNumber(r && (r.value ?? r.y)) }))
      .filter(r => r.value !== null);
  }
  if (cleaned.length === 0) throw shape('Chart has no plottable rows');
  const known = ['bar', 'line', 'histogram', 'scatter', 'heatmap', 'pie', 'doughnut'];
  return {
    id: asText(raw.id, 'chart'), title: asText(raw.title, 'Chart'), type: known.includes(type) ? type : 'bar',
    question: asText(raw.question), outcome: asText(raw.outcome),
    xLabel: asText(raw.x_label), yLabel: asText(raw.y_label), rows: cleaned,
  };
}

export function adaptCharts(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The charts file has an unexpected shape');
  const out = [];
  for (const r of rows) { try { out.push(adaptChart(r)); } catch { /* one bad chart never hides the others */ } }
  if (out.length === 0) throw shape('No usable charts found');
  const seen = new Set();
  out.forEach((c, i) => {
    if (seen.has(c.id)) c.id = c.id + '-' + i;
    seen.add(c.id);
  });
  return out;
}

export function adaptSegments(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The segments file has an unexpected shape');
  const items = rows.map((s, i) => {
    if (!isObj(s)) return null;
    const summary = {};
    if (isObj(s.summary)) {
      for (const [k, v] of Object.entries(s.summary)) {
        const n = asNumber(v);
        if (n !== null && !PII.test(k)) summary[k] = n;
      }
    }
    return {
      id: 'segment-' + i,
      name: asText(s.name ?? s.segment, 'Segment ' + (i + 1)),
      size: asNumber(s.size ?? s.count) ?? 0,
      share: asNumber(s.share),
      description: asText(s.description),
      summary,
    };
  }).filter(Boolean);
  if (items.length === 0) throw shape('No usable segments found');
  const total = items.reduce((acc, s) => acc + s.size, 0);
  for (const s of items) if (s.share === null) s.share = total ? (s.size / total) * 100 : 0;
  return { method: asText(raw && raw.method), items };
}

export function adaptAnomalies(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The anomalies file has an unexpected shape');
  const items = rows.filter(isObj).map((a, i) => ({
    id: asText(a.id, 'anomaly-' + i) + '#' + i,
    date: a.date === null || a.date === undefined ? null : asText(a.date),
    metric: asText(a.metric),
    value: asNumber(a.value),
    expected: asNumber(a.expected),
    score: asNumber(a.score),
    reason: asText(a.reason),
  }));
  return {
    method: asText(raw && raw.method),
    total: (raw && asNumber(raw.total)) ?? items.length,
    rate: raw && !Array.isArray(raw) ? asNumber(raw.rate) : null,
    items,
  };
}

export function adaptInsights(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The insights file has an unexpected shape');
  const items = rows.filter(r => isObj(r) && asText(r.finding)).map((r, i) => ({
    id: 'insight-' + i,
    severity: normSeverity(r.severity),
    category: asText(r.category),
    finding: asText(r.finding),
    evidence: asText(r.evidence),
    action: asText(r.action),
    outcome: asText(r.outcome),
  }));
  if (items.length === 0 && rows.length > 0) throw shape('No usable insights found');
  return items.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

export function adaptRecommendations(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The recommendations file has an unexpected shape');
  const items = rows.filter(r => isObj(r) && (asText(r.title) || asText(r.action))).map((r, i) => ({
    id: 'rec-' + i,
    priority: normPriority(r.priority),
    title: asText(r.title, asText(r.action)),
    action: asText(r.action),
    evidence: asText(r.evidence),
    impact: asText(r.impact),
    when: asText(r.when),
    count: asNumber(r.count),
  }));
  if (items.length === 0 && rows.length > 0) throw shape('No usable recommendations found');
  return items.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
}

export function adaptSimulationIndex(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The simulations index has an unexpected shape');
  const items = rows.filter(r => isObj(r) && asText(r.id)).map(r => {
    const id = asText(r.id);
    const file = asText(r.file) || 'decide/simulations/' + id + '.json';
    if (file.includes('..') || /^[a-zA-Z]:|^\\|^\//.test(file)) throw shape('A simulation file path is not allowed');
    return { id, title: asText(r.title, humanize(id)), file };
  });
  return items;
}

export function adaptSimulation(raw) {
  if (!isObj(raw) || !isObj(raw.variable)) throw shape('The simulation file has an unexpected shape');
  const table = (Array.isArray(raw.table) ? raw.table : []).map(r => {
    const x = asNumber(r && r.x);
    if (x === null || !isObj(r.values)) return null;
    const values = {};
    for (const [k, v] of Object.entries(r.values)) {
      const n = asNumber(v);
      if (n !== null) values[k] = n;
    }
    return Object.keys(values).length ? { x, values } : null;
  }).filter(Boolean).sort((a, b) => a.x - b.x);
  if (table.length < 2) throw shape('The simulation table is too small');
  const v = raw.variable;
  const min = asNumber(v.min) ?? table[0].x;
  const max = asNumber(v.max) ?? table[table.length - 1].x;
  let outputs = (Array.isArray(raw.outputs) ? raw.outputs : []).filter(o => isObj(o) && o.key).map(o => ({
    key: asText(o.key), label: asText(o.label, humanize(o.key)), format: asText(o.format) || 'decimal',
  }));
  if (outputs.length === 0) outputs = Object.keys(table[0].values).map(key => ({ key, label: humanize(key), format: 'decimal' }));
  const start = asNumber(v.default) ?? min;
  return {
    id: asText(raw.id), title: asText(raw.title), description: asText(raw.description),
    variable: {
      key: asText(v.key), label: asText(v.label, humanize(v.key)), unit: asText(v.unit), min, max,
      step: asNumber(v.step) || 1, default: Math.min(max, Math.max(min, start)), format: asText(v.format) || 'decimal',
    },
    outputs, table,
    assumptions: (Array.isArray(raw.assumptions) ? raw.assumptions : []).map(a => asText(a)),
  };
}

export function adaptGoals(raw) {
  if (!isObj(raw) && !Array.isArray(raw)) throw shape('The goals file has an unexpected shape');
  let entries;
  if (Array.isArray(raw) || Array.isArray(raw.items)) {
    entries = listOf(raw).map((g, i) => [asText(g && (g.key ?? g.id), 'goal_' + i), g]);
  } else {
    entries = Object.entries(raw).filter(([k]) => !k.startsWith('_') && k !== 'generated_at' && k !== 'schema_version');
  }
  return entries.map(([key, g]) => {
    if (isObj(g)) {
      return {
        key, label: asText(g.label, humanize(key)), target: asNumber(g.target ?? g.value), unit: asText(g.unit),
        description: asText(g.description), clientSets: Boolean(g.client_sets ?? g.clientSets),
      };
    }
    if (g === null || typeof g === 'number') {
      return { key, label: humanize(key), target: asNumber(g), unit: '', description: '', clientSets: false };
    }
    return null;
  }).filter(Boolean);
}

export function adaptGoalProgress(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The goal progress file has an unexpected shape');
  const STATUS = ['on_track', 'at_risk', 'off_track', 'no_target'];
  return rows.filter(isObj).map((g, i) => {
    const target = asNumber(g.target);
    const actual = asNumber(g.actual);
    let pct = asNumber(g.pct);
    if (pct === null && target && actual !== null) pct = (actual / target) * 100;
    const status = asText(g.status).toLowerCase();
    return {
      id: 'progress-' + i, key: asText(g.key), label: asText(g.label, humanize(g.key)), target, actual,
      unit: asText(g.unit), pct, status: STATUS.includes(status) ? status : target === null ? 'no_target' : 'at_risk',
    };
  });
}

export function adaptAlerts(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The alerts file has an unexpected shape');
  return rows.filter(isObj).map((a, i) => ({
    id: 'alert-' + i, severity: normSeverity(a.severity), title: asText(a.title, asText(a.metric, 'Alert')),
    message: asText(a.message), metric: asText(a.metric), value: asNumber(a.value), threshold: asNumber(a.threshold),
    since: asText(a.since),
  })).sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

const TIME_KEYS = ['t', 'date', 'ds', 'week', 'period'];
const VALUE_KEYS = ['forecast', 'prediction', 'yhat', 'value'];
const pick = (row, keys) => {
  for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k];
  return undefined;
};

export function adaptForecast(raw) {
  let meta = {};
  let fc;
  let hist = [];
  if (Array.isArray(raw)) {
    fc = raw;
  } else if (isObj(raw) && Array.isArray(raw.forecast)) {
    meta = raw;
    fc = raw.forecast;
    hist = Array.isArray(raw.history) ? raw.history : [];
  } else {
    throw shape('The forecast file has an unexpected shape');
  }
  const mapRow = r => {
    if (!isObj(r)) return null;
    const t = pick(r, TIME_KEYS);
    const value = asNumber(pick(r, VALUE_KEYS));
    if (t === undefined || value === null) return null;
    return { t: asText(t), value, low: asNumber(r.low ?? r.lower ?? r.yhat_lower), high: asNumber(r.high ?? r.upper ?? r.yhat_upper) };
  };
  const forecast = fc.map(mapRow).filter(Boolean);
  const history = hist.map(mapRow).filter(Boolean);
  if (forecast.length === 0 && history.length === 0) throw shape('The forecast has no usable rows');
  const e = meta.error;
  let error = null;
  if (isObj(e)) {
    const mae = asNumber(e.mae);
    const mape = asNumber(e.mape);
    if (mae !== null || mape !== null) {
      error = { mae, mape, baselineMae: asNumber(e.baseline_mae ?? e.baselineMae), period: asText(e.period) };
    }
  }
  return {
    metric: asText(meta.metric), unit: asText(meta.unit), horizon: asText(meta.horizon), method: asText(meta.method),
    history, forecast, error, note: asText(meta.note),
  };
}

export function adaptCube(raw) {
  if (!isObj(raw)) throw shape('The explorer file has an unexpected shape');
  const AGG = ['sum', 'mean', 'rate', 'ratio', 'count'];
  const FORMATS = ['currency', 'percent', 'integer', 'decimal'];
  const rows = (Array.isArray(raw.rows) ? raw.rows : []).map(r => {
    if (!isObj(r) || r.t === undefined || r.t === null || !isObj(r.m)) return null;
    const m = {};
    for (const [k, c] of Object.entries(r.m)) {
      if (isObj(c)) m[k] = { sum: asNumber(c.sum) ?? 0, n: asNumber(c.n) ?? 0 };
    }
    const d = {};
    if (isObj(r.d)) for (const [k, v] of Object.entries(r.d)) d[k] = asText(v);
    return { d, t: asText(r.t), m };
  }).filter(Boolean);
  if (rows.length === 0) throw shape('The explorer file has no rows');
  const metrics = (Array.isArray(raw.metrics) ? raw.metrics : []).filter(m => isObj(m) && m.key).map(m => ({
    key: asText(m.key), label: asText(m.label, humanize(m.key)),
    agg: AGG.includes(asText(m.agg)) ? asText(m.agg) : 'sum',
    format: FORMATS.includes(asText(m.format)) ? asText(m.format) : 'decimal',
    num: asText(m.num), den: asText(m.den),
  }));
  if (metrics.length === 0) throw shape('The explorer file lists no metrics');
  const dimensions = (Array.isArray(raw.dimensions) ? raw.dimensions : []).filter(d => isObj(d) && d.key).map(d => {
    const key = asText(d.key);
    let values = (Array.isArray(d.values) ? d.values : []).map(v => asText(v));
    if (values.length === 0) values = [...new Set(rows.map(r => r.d[key]).filter(v => v !== undefined))].sort();
    return { key, label: asText(d.label, humanize(key)), values };
  });
  const times = rows.map(r => r.t).sort();
  const time = isObj(raw.time) ? raw.time : {};
  return {
    dimensions, metrics, rows,
    time: { grain: asText(time.grain, 'month'), min: asText(time.min) || times[0], max: asText(time.max) || times[times.length - 1] },
  };
}

export function adaptScorer(raw) {
  if (!raw || typeof raw !== 'object') throw shape('The scoring file has an unexpected shape');
  const type = asText(raw.type).toLowerCase();
  if (type !== 'linear' && type !== 'knn') throw shape('Scoring type must be linear or knn');
  const task = asText(raw.task, 'classification').toLowerCase() === 'regression' ? 'regression' : 'classification';
  const fields = (Array.isArray(raw.fields) ? raw.fields : []).map(f => {
    if (!f || typeof f !== 'object' || !f.key) return null;
    const ftype = ['number', 'category', 'boolean'].includes(f.type) ? f.type : 'number';
    const options = ftype === 'boolean' ? ['No', 'Yes'] : (Array.isArray(f.options) ? f.options.map(o => asText(o)) : []);
    if (ftype !== 'number' && options.length === 0) return null;
    return {
      key: asText(f.key), label: asText(f.label, humanize(f.key)), type: ftype, unit: asText(f.unit),
      min: asNumber(f.min), max: asNumber(f.max), step: asNumber(f.step) || 1,
      default: ftype === 'number' ? asNumber(f.default) : (f.default === undefined || f.default === null ? null : asText(f.default)),
      options, help: asText(f.help),
    };
  }).filter(Boolean);
  if (fields.length === 0) throw shape('The scoring file lists no input fields');
  const keys = new Set(fields.map(f => f.key));
  const out = {
    type, task, fields,
    target: { label: asText(raw.target && raw.target.label, 'Predicted value'), format: asText(raw.target && raw.target.format, task === 'classification' ? 'percent' : 'decimal'), positive: asText(raw.target && raw.target.positive_label) },
    riskLevels: (Array.isArray(raw.risk_levels) ? raw.risk_levels : []).map(l => ({ max: asNumber(l && l.max), label: asText(l && l.label) })).filter(l => l.max !== null && l.label).sort((a, b) => a.max - b.max),
    fidelity: raw.fidelity && typeof raw.fidelity === 'object' ? { metric: asText(raw.fidelity.metric), value: asNumber(raw.fidelity.value), n: asNumber(raw.fidelity.n), quality: asText(raw.fidelity.quality), note: asText(raw.fidelity.note) } : null,
    note: asText(raw.note),
  };
  if (type === 'linear') {
    const lin = raw.linear;
    const terms = lin && Array.isArray(lin.terms) ? lin.terms : null;
    if (!lin || asNumber(lin.intercept) === null || !terms) throw shape('Linear scoring needs an intercept and terms');
    out.linear = {
      intercept: asNumber(lin.intercept), link: asText(lin.link, 'identity') === 'logit' ? 'logit' : 'identity',
      terms: terms.map(t => {
        if (!t || !keys.has(asText(t.field)) || asNumber(t.coef) === null) throw shape('A scoring term refers to an unknown field');
        const categorical = t.value !== undefined && t.value !== null;
        return { field: asText(t.field), coef: asNumber(t.coef), value: categorical ? asText(t.value) : null, mean: asNumber(t.mean) || 0, scale: asNumber(t.scale) || 1 };
      }),
    };
  } else {
    const knn = raw.knn;
    const ref = knn && Array.isArray(knn.reference) ? knn.reference : null;
    if (!ref) throw shape('Neighbour scoring needs a reference table');
    const reference = ref.map(r => ({ x: r && r.x && typeof r.x === 'object' ? r.x : null, y: asNumber(r && r.y) })).filter(r => r.x && r.y !== null);
    if (reference.length < 5) throw shape('The reference table is too small to predict from');
    const std = {};
    for (const f of fields) if (f.type === 'number') std[f.key] = asNumber(knn.std && knn.std[f.key]) || 1;
    out.knn = { k: Math.max(1, Math.round(asNumber(knn.k) || 25)), std, reference };
  }
  return out;
}

export function adaptForecastLookup(raw) {
  const table = raw && Array.isArray(raw.table) ? raw.table : null;
  if (!table) throw shape('The lookup file has an unexpected shape');
  const rows = table
    .map(r => ({ x: asNumber(r && r.x), value: asNumber(r && r.value), low: asNumber(r && r.low), high: asNumber(r && r.high) }))
    .filter(r => r.x !== null && r.value !== null)
    .sort((a, b) => a.x - b.x);
  if (rows.length === 0) throw shape('The lookup table has no usable rows');
  return { inputLabel: asText(raw.input_label, 'Input'), outputLabel: asText(raw.output_label, 'Result'), table: rows };
}
