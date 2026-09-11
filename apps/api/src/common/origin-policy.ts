const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isOriginAllowed(method: string, origin: string | undefined, allowedOrigins: string[]): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}
