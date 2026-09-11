import type { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  compact?: boolean;
};

export function StatePanel({ eyebrow, title, description, action, tone = 'neutral', compact = false }: Props) {
  return <section className={`rs-state rs-state--${tone}${compact ? ' rs-state--compact' : ''}`} role={tone === 'danger' ? 'alert' : 'status'}>
    <div className="rs-state__icon" aria-hidden="true">{tone === 'success' ? '✓' : tone === 'warning' ? '!' : tone === 'danger' ? '×' : '•'}</div>
    <div>{eyebrow && <p className="rs-state__eyebrow">{eyebrow}</p>}<h2>{title}</h2><p>{description}</p>{action && <div className="rs-state__action">{action}</div>}</div>
  </section>;
}
