import { useDataset } from '../../hooks/useDataset.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ErrorBoundary } from '../shared/ErrorBoundary.jsx';
import { ChartPanel } from './ChartPanel.jsx';

export function ChartGrid() {
  const query = useDataset('charts');
  if (query.loading || query.error) {
    return <DataState query={query} label="charts" skeleton={<SkeletonCard count={4} height={352} />} />;
  }
  return (
    <section className="grid chart-grid" aria-label="Charts">
      {query.data.map(chart => (
        <ErrorBoundary key={chart.id} label={chart.title}>
          <ChartPanel chart={chart} />
        </ErrorBoundary>
      ))}
    </section>
  );
}
