export function interpolate(table, x) {
  if (!Array.isArray(table) || table.length === 0) return null;
  if (x <= table[0].x) return table[0].values;
  const last = table[table.length - 1];
  if (x >= last.x) return last.values;
  let i = 1;
  while (i < table.length && table[i].x < x) i += 1;
  const a = table[i - 1];
  const b = table[i];
  const t = (x - a.x) / (b.x - a.x || 1);
  const out = {};
  for (const key of Object.keys(a.values)) {
    const from = a.values[key];
    const to = b.values[key] === undefined ? from : b.values[key];
    out[key] = from + (to - from) * t;
  }
  return out;
}
