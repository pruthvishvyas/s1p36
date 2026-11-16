import { PageSection } from '../components/shared/PageSection.jsx';
import { KPICards } from '../components/understand/KPICards.jsx';
import { ChartGrid } from '../components/understand/ChartGrid.jsx';
import { SegmentExplorer } from '../components/understand/SegmentExplorer.jsx';
import { AnomalyTable } from '../components/understand/AnomalyTable.jsx';
import { InsightCards } from '../components/decide/InsightCards.jsx';
import { RecommendationEngine } from '../components/decide/RecommendationEngine.jsx';
import { WhatIfSimulator } from '../components/decide/WhatIfSimulator.jsx';
import { GoalTracker } from '../components/decide/GoalTracker.jsx';
import { Forecaster } from '../components/monitor/Forecaster.jsx';
import { Predictor } from '../components/monitor/Predictor.jsx';
import { GoalProgress } from '../components/monitor/GoalProgress.jsx';
import { AlertCenter } from '../components/monitor/AlertCenter.jsx';
import { InteractiveExplorer } from '../components/explorer/InteractiveExplorer.jsx';
import { UserManual } from '../components/manual/UserManual.jsx';
import { DataHealth } from '../components/health/DataHealth.jsx';
import { ROUTES } from '../utils/routes.js';

const PAGES = {
  'understand/overview': () => (
    <div className="stack">
      <KPICards />
      <ChartGrid />
    </div>
  ),
  'understand/segments': () => <SegmentExplorer />,
  'understand/anomalies': () => <AnomalyTable />,
  'decide/insights': () => <InsightCards />,
  'decide/recommendations': () => <RecommendationEngine />,
  'decide/what-if': () => <WhatIfSimulator />,
  'decide/goals': () => <GoalTracker />,
  'monitor/forecast': () => <Forecaster />,
  'monitor/predict': () => <Predictor />,
  'monitor/progress': () => <GoalProgress />,
  'monitor/alerts': () => <AlertCenter />,
  'explore': () => <InteractiveExplorer />,
  'guide': () => <UserManual />,
  'health': () => <DataHealth />,
};

export function Dashboard({ route }) {
  const meta = ROUTES.find(r => r.id === route) || ROUTES[0];
  const render = PAGES[meta.id] || PAGES['understand/overview'];
  return (
    <main className="content" id="content">
      <PageSection title={meta.title} blurb={meta.blurb}>
        {render()}
      </PageSection>
    </main>
  );
}
