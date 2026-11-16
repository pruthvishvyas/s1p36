import { SkeletonCard } from './SkeletonCard.jsx';
import { refreshHint } from '../../utils/text.js';

export function DataState({ query, label, skeleton }) {
  if (query.loading) return skeleton || <SkeletonCard count={2} />;
  const err = query.error;
  if (!err) return null;
  let body;
  let retry = false;
  if (err.kind === 'skipped') {
    body = <p>{'This section was skipped: ' + err.message}</p>;
  } else if (err.kind === 'missing' || err.kind === 'empty') {
    body = <p>{'No ' + label + ' yet. ' + refreshHint()}</p>;
    retry = true;
  } else if (err.kind === 'network') {
    body = <p>{'Could not load ' + label + '. Check the connection.'}</p>;
    retry = true;
  } else {
    body = (
      <div>
        <p>{'The ' + label + ' file is not in the expected format.'}</p>
        <p className="muted">{err.message}</p>
      </div>
    );
  }
  return (
    <div className="card state-card" role="status">
      {body}
      {retry ? <button type="button" className="btn-secondary" onClick={query.reload}>Retry</button> : null}
    </div>
  );
}
