import { useEffect } from 'react';
import { TerminologyProvider } from './context/TerminologyContext.jsx';
import { FormatProvider } from './context/FormatContext.jsx';
import { ExplorerProvider } from './context/ExplorerContext.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useContract } from './hooks/useContract.js';
import { Sidebar } from './components/shared/Sidebar.jsx';
import { Header } from './components/shared/Header.jsx';
import { ErrorBoundary } from './components/shared/ErrorBoundary.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { refreshHint } from './utils/text.js';

function ContractBanner() {
  const contract = useContract();
  if (!contract.error) return null;
  return (
    <div className="banner" role="status">
      {'The project description file could not be read (' + contract.error.message + '). Pages that can find their own data still work. ' + refreshHint()}
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);
  return (
    <TerminologyProvider>
      <FormatProvider>
        <ExplorerProvider>
          <div className="app-shell">
            <Sidebar route={route} />
            <div className="app-main">
              <Header />
              <ContractBanner />
              <ErrorBoundary key={route} label="This page">
                <Dashboard route={route} />
              </ErrorBoundary>
            </div>
          </div>
        </ExplorerProvider>
      </FormatProvider>
    </TerminologyProvider>
  );
}
