'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function VisitTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    void fetch(`${API}/analytics/visit`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);
  return null;
}
