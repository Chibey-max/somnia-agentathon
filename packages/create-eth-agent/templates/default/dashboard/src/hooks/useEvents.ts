'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ExecutedEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  target: string;
  value: string;
  selector: string;
  action: string;
  logIndex: number;
}

export function useEvents(limit = 50, interval = 60000) {
  const [events, setEvents] = useState<ExecutedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch(`/api/events?limit=${limit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEvents(json.events || []);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
    const timer = setInterval(fetch, interval);
    return () => clearInterval(timer);
  }, [fetch, interval]);

  return { events, loading, error, refetch: fetch };
}
