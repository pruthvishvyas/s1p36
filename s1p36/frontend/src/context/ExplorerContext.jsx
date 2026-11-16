import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ExplorerContext = createContext(null);

export function ExplorerProvider({ children }) {
  const [filters, setFilters] = useState({});
  const [metricKey, setMetricKey] = useState('');

  const setFilter = useCallback((dim, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (!value || prev[dim] === value) delete next[dim];
      else next[dim] = value;
      return next;
    });
  }, []);
  const clearFilters = useCallback(() => setFilters({}), []);
  const activeCount = Object.keys(filters).filter(k => filters[k]).length;

  const value = useMemo(
    () => ({ filters, setFilter, clearFilters, metricKey, setMetricKey, activeCount }),
    [filters, setFilter, clearFilters, metricKey, activeCount]
  );
  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorer() {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error('useExplorer needs ExplorerProvider');
  return ctx;
}
