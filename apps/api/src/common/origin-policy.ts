const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Cookie authentication means every state-changing request must prove it came
// from a trusted site. Browsers always send Origin on cross-origin and on
// same-origin unsafe requests, so a missing Origin on an unsafe method is
// either a non-browser client or a stripped-header CSRF attempt; neither is
// allowed to mutate state. Clients that legitimately call the API without a
// browser must send an explicit Origin from the allow list.
export function isOriginAllowed(method: string, origin: string | undefined, allowedOrigins: string[]): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}
