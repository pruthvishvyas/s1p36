import { useEffect, useState } from 'react';
import { DEFAULT_ROUTE, ROUTES } from '../utils/routes.js';

function readRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return ROUTES.some(r => r.id === hash) ? hash : DEFAULT_ROUTE;
}

export function useHashRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
