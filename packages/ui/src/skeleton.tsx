export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`rs-skeleton ${className}`} aria-hidden="true" />;
}
