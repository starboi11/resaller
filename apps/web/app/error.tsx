'use client';

import { useEffect } from 'react';
import { StatePanel } from '@resaller/ui';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="shell py-16">
      <StatePanel
        tone="danger"
        eyebrow="Xatolik"
        title="Sahifani ochib bo‘lmadi"
        description="Bu vaqtinchalik xato bo‘lishi mumkin. Ma’lumotlaringiz o‘zgartirilmadi."
        action={
          <button className="rs-button" onClick={reset}>
            Qayta urinish
          </button>
        }
      />
    </main>
  );
}
