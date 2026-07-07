import { useEffect, useState } from 'react';

/**
 * Returns `now`, refreshed on an interval. Slows to a 5 s cadence while the
 * tab is hidden — correctness never depends on tick rate because all session
 * math derives from timestamps.
 */
export function useTicker(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const start = () => {
      clearInterval(id);
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), document.hidden ? 5000 : intervalMs);
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', start);
    };
  }, [intervalMs]);

  return now;
}
