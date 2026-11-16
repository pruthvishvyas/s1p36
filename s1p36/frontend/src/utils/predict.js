const sigmoid = z => 1 / (1 + Math.exp(-z));

export function defaultsFor(fields) {
  const out = {};
  for (const f of fields) {
    if (f.default !== null && f.default !== undefined && f.default !== '') out[f.key] = f.default;
    else if (f.type === 'number') out[f.key] = f.min !== null ? f.min : 0;
    else out[f.key] = f.options.length ? f.options[0] : '';
  }
  return out;
}

// problems block the Predict button; warnings only show a caution under the field
export function validateInputs(fields, values) {
  const problems = [];
  const warnings = [];
  for (const f of fields) {
    const v = values[f.key];
    if (f.type === 'number') {
      const n = Number(v);
      if (v === '' || v === null || v === undefined || !Number.isFinite(n)) {
        problems.push({ key: f.key, message: f.label + ' needs a number' });
      } else if ((f.min !== null && n < f.min) || (f.max !== null && n > f.max)) {
        warnings.push({ key: f.key, message: f.label + ' is outside the range seen in the data (' + f.min + ' to ' + f.max + ')' });
      }
    } else if (!f.options.includes(String(v))) {
      problems.push({ key: f.key, message: 'Choose a value for ' + f.label });
    }
  }
  return { problems, warnings };
}

function scoreLinear(scorer, values) {
  const { intercept, link, terms } = scorer.linear;
  let z = intercept;
  const drivers = [];
  for (const t of terms) {
    let contribution = 0;
    if (t.value === null) {
      contribution = ((Number(values[t.field]) - t.mean) / (t.scale || 1)) * t.coef;
    } else if (String(values[t.field]) === String(t.value)) {
      contribution = t.coef;
    }
    z += contribution;
    drivers.push({ field: t.field, contribution });
  }
  const value = link === 'logit' ? sigmoid(z) * 100 : z;
  drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return { value, low: null, high: null, drivers: drivers.slice(0, 3), neighbors: null };
}

function scoreKnn(scorer, values) {
  const { k, std, reference } = scorer.knn;
  const scored = reference
    .map(row => {
      let d = 0;
      for (const f of scorer.fields) {
        if (f.type === 'number') {
          const diff = (Number(values[f.key]) - Number(row.x[f.key])) / (std[f.key] || 1);
          d += diff * diff;
        } else if (String(values[f.key]) !== String(row.x[f.key])) {
          d += 1;
        }
      }
      return { d: Math.sqrt(d), y: row.y };
    })
    .sort((a, b) => a.d - b.d);
  const near = scored.slice(0, Math.max(1, Math.min(k, scored.length)));
  let weights = 0;
  let total = 0;
  for (const n of near) {
    const w = 1 / (n.d + 0.05);
    weights += w;
    total += w * n.y;
  }
  const ys = near.map(n => n.y).sort((a, b) => a - b);
  const at = p => ys[Math.min(ys.length - 1, Math.max(0, Math.round(p * (ys.length - 1))))];
  return { value: total / weights, low: at(0.1), high: at(0.9), drivers: [], neighbors: near.length };
}

export function riskLabel(levels, value) {
  if (!Array.isArray(levels) || levels.length === 0) return '';
  for (const level of levels) if (value <= level.max) return level.label;
  return levels[levels.length - 1].label;
}

export function predict(scorer, values) {
  const raw = scorer.type === 'linear' ? scoreLinear(scorer, values) : scoreKnn(scorer, values);
  const clamp = v => (v === null || scorer.task !== 'classification' ? v : Math.min(100, Math.max(0, v)));
  const value = clamp(raw.value);
  return {
    ...raw,
    value,
    low: clamp(raw.low),
    high: clamp(raw.high),
    label: scorer.task === 'classification' ? riskLabel(scorer.riskLevels, value) : '',
  };
}

// Forecast-only projects: read the value for a chosen future period
export function forecastAt(forecast, t) {
  const row = forecast.forecast.find(r => String(r.t) === String(t));
  return row ? { value: row.value, low: row.low, high: row.high } : null;
}

// Single-number lookup tables: linear interpolation, flagged when outside the table
export function lookupAt(table, x) {
  if (!Array.isArray(table) || table.length === 0) return null;
  const first = table[0];
  const last = table[table.length - 1];
  const pick = (a, b, t) => {
    const mix = key => (a[key] === null || b[key] === null ? null : a[key] + (b[key] - a[key]) * t);
    return { value: mix('value'), low: mix('low'), high: mix('high') };
  };
  if (x <= first.x) return { ...pick(first, first, 0), outside: x < first.x };
  if (x >= last.x) return { ...pick(last, last, 0), outside: x > last.x };
  let i = 1;
  while (i < table.length && table[i].x < x) i += 1;
  const a = table[i - 1];
  const b = table[i];
  return { ...pick(a, b, (x - a.x) / (b.x - a.x || 1)), outside: false };
}
