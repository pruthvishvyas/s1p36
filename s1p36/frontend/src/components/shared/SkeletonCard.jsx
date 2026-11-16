export function SkeletonCard({ count = 3, height = 112 }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {items.map(i => <div key={i} className="skeleton" style={{ height: height / 16 + 'rem' }} />)}
    </div>
  );
}
