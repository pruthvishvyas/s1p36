export function SeverityBadge({ level }) {
  const key = String(level || 'LOW').toLowerCase();
  const names = { high: 'High', medium: 'Medium', low: 'Low' };
  return <span className={'badge badge-' + key}>{names[key] || 'Low'}</span>;
}
