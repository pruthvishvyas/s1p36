function parseDate(iso) {
  const s = String(iso === null || iso === undefined ? '' : iso);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), monthOnly: false };
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return { date: new Date(Number(m[1]), Number(m[2]) - 1, 1), monthOnly: true };
  const d = new Date(s);
  return { date: d, monthOnly: false };
}

export function guessUnitFormat(unit, metric) {
  const u = String(unit || '').toLowerCase();
  if (['currency', 'percent', 'integer', 'decimal'].includes(u)) return u;
  const text = u + ' ' + String(metric || '').toLowerCase();
  if (/(percent|%|pct|rate)/.test(text)) return 'percent';
  if (/(usd|eur|gbp|\$|revenue|sales|currency|money)/.test(text)) return 'currency';
  return 'decimal';
}

export function createFormatter(summary) {
  const locale = (summary && summary.locale) || 'en-US';
  const cur = summary && summary.currency ? summary.currency : null;
  const symbol = cur && cur.symbol ? cur.symbol : '';
  const make = opts => {
    try {
      return new Intl.NumberFormat(locale, opts);
    } catch {
      return new Intl.NumberFormat('en-US', opts);
    }
  };
  let money = null;
  if (cur && cur.code) {
    try {
      money = new Intl.NumberFormat(locale, { style: 'currency', currency: cur.code, maximumFractionDigits: 0 });
    } catch {
      money = null;
    }
  }
  const whole = make({ maximumFractionDigits: 0 });
  const dec = make({ maximumFractionDigits: 2 });
  const one = make({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const short = make({ notation: 'compact', maximumFractionDigits: 1 });
  const num = v => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? NaN : Number(v));

  const value = (v, format) => {
    if (format === 'text') return v === null || v === undefined ? '-' : String(v);
    const n = num(v);
    if (!Number.isFinite(n)) return v === null || v === undefined || v === '' ? '-' : String(v);
    switch (format) {
      case 'currency': return money ? money.format(n) : symbol + whole.format(n);
      case 'percent': return one.format(n) + '%';
      case 'integer': return whole.format(n);
      default: return dec.format(n);
    }
  };

  const compact = v => {
    const n = num(v);
    return Number.isFinite(n) ? short.format(n) : String(v);
  };

  const date = iso => {
    const p = parseDate(iso);
    if (Number.isNaN(p.date.getTime())) return String(iso === null || iso === undefined ? '' : iso);
    try {
      const opts = p.monthOnly ? { month: 'short', year: 'numeric' } : { dateStyle: 'medium' };
      return new Intl.DateTimeFormat(locale, opts).format(p.date);
    } catch {
      return String(iso);
    }
  };

  const ago = iso => {
    const p = parseDate(iso);
    if (Number.isNaN(p.date.getTime())) return '';
    const diff = (p.date.getTime() - Date.now()) / 1000;
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      for (const [unit, seconds] of units) {
        if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
      }
    } catch {
      return date(iso);
    }
    return 'just now';
  };

  return { value, compact, percent: v => value(v, 'percent'), date, ago };
}

export function formatWithUnit(fmt, v, unit) {
  if (['currency', 'percent', 'integer', 'decimal'].includes(unit)) return fmt.value(v, unit);
  const text = fmt.value(v, 'decimal');
  return unit ? text + ' ' + unit : text;
}
