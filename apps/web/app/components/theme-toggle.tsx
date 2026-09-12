'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const saved = localStorage.getItem('resaller-theme');
    const initial: Theme =
      saved === 'light' || saved === 'dark' ? saved : 'system';
    setTheme(initial);
    applyTheme(initial);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      if ((localStorage.getItem('resaller-theme') ?? 'system') === 'system')
        applyTheme('system');
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function cycle() {
    const next: Theme =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    localStorage.setItem('resaller-theme', next);
    applyTheme(next);
  }
  const label =
    theme === 'system'
      ? 'Tizim mavzusi'
      : theme === 'light'
        ? 'Yorug‘ mavzu'
        : 'Tungi mavzu';
  return (
    <button
      type="button"
      className="icon-button"
      onClick={cycle}
      aria-label={`${label}. Mavzuni almashtirish`}
      title={label}
    >
      <span aria-hidden="true">
        {theme === 'system' ? '◐' : theme === 'light' ? '☀' : '☾'}
      </span>
    </button>
  );
}
