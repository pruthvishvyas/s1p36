export function ProgressBar({ pct, status }) {
  const width = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)}>
      <div className={'bar-fill ' + (status || '')} style={{ width: width + '%' }} />
    </div>
  );
}
