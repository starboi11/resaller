'use client';

import { useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function StoreActions({ publicId, trustBadge }: { publicId: string; trustBadge: string }) {
  const [following, setFollowing] = useState(false);
  const [notice, setNotice] = useState('');
  async function toggle() {
    const response = await fetch(`${API}/stores/${publicId}/follow`, { method: following ? 'DELETE' : 'POST', credentials: 'include' });
    if (response.status === 401) return void (window.location.href = '/login');
    if (response.ok) setFollowing((value) => !value);
  }
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else { await navigator.clipboard.writeText(url); setNotice('Havola nusxalandi'); }
    } catch { setNotice('Ulashish bekor qilindi'); }
  }
  return <div className="store-hero__actions"><span>✓ {trustBadge.replaceAll('_', ' ')}</span><button onClick={() => void toggle()} aria-pressed={following}>{following ? '✓ Kuzatilmoqda' : '+ Kuzatish'}</button><button onClick={() => void share()}>Ulashish</button>{notice && <small role="status">{notice}</small>}</div>;
}
