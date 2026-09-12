'use client';

import { useEffect, useState } from 'react';

export function NetworkStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline ? (
    <div className="network-banner" role="status">
      Internet uzildi. Saqlanmagan amallarni qayta urinib ko‘ring.
    </div>
  ) : null;
}
