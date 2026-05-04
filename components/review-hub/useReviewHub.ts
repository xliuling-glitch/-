'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReviewHubData } from '@/lib/review-hub/types';
import { loadReviewHub, saveReviewHub } from '@/lib/review-hub/storage';

export function useReviewHub() {
  const [data, setDataState] = useState<ReviewHubData>(() =>
    typeof window !== 'undefined' ? loadReviewHub() : { shopTargets: {}, assignments: [], submissions: [] },
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDataState(loadReviewHub());
    setHydrated(true);
  }, []);

  const setData = useCallback((next: ReviewHubData | ((prev: ReviewHubData) => ReviewHubData)) => {
    setDataState((prev) => {
      const n = typeof next === 'function' ? (next as (p: ReviewHubData) => ReviewHubData)(prev) : next;
      saveReviewHub(n);
      return n;
    });
  }, []);

  return { data, setData, hydrated };
}

export function useOptionsShops() {
  const [shops, setShops] = useState<string[]>([]);
  const [staffRoster, setStaffRoster] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then((d) => {
        setShops(Array.isArray(d.shops) ? d.shops : []);
        setStaffRoster(Array.isArray(d.staff_roster) ? d.staff_roster : []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return { shops, staffRoster, loaded };
}
