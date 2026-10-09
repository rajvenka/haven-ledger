/**
 * Zerodha (Kite Connect) one-click login.
 * Flow: save the pending connection details -> go to Kite login in the SAME tab -> Kite redirects
 * back to this app with ?request_token=... -> App captures it, exchanges it for the daily
 * access token, saves the connection and refreshes holdings. No copy/paste.
 * One-time setup: the Redirect URL of the Kite app must be this app's URL (see zerodhaRedirectUrl).
 */
const PENDING_KEY = 'hv_zerodha_pending';
export const ZERODHA_AUTOSYNC_KEY = 'hv_zerodha_autosync';

export interface ZerodhaPending {
  apiKey: string;
  apiSecret: string;
  portfolioId?: string;
  label?: string;
  ts: number;
}

export const zerodhaRedirectUrl = () => (typeof window !== 'undefined' ? `${window.location.origin}/` : '');

export function startZerodhaLogin(p: Omit<ZerodhaPending, 'ts'>) {
  const apiKey = p.apiKey.trim();
  if (!apiKey) return false;
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, apiKey, ts: Date.now() })); } catch { /* ignore */ }
  window.location.href = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}`;
  return true;
}

export function readZerodhaPending(): ZerodhaPending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    // Request tokens are valid for minutes - ignore stale pending state (> 30 min).
    if (!p || Date.now() - Number(p.ts || 0) > 30 * 60 * 1000) return null;
    return p;
  } catch { return null; }
}
export const clearZerodhaPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } };

/** request_token from the current URL (Kite redirect), or null. */
export function readZerodhaCallback(): { requestToken: string; failed: boolean } | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const token = q.get('request_token');
  if (!token) return null;
  return { requestToken: token, failed: (q.get('status') || 'success') !== 'success' };
}

export function stripZerodhaCallbackFromUrl() {
  try {
    const u = new URL(window.location.href);
    ['request_token', 'action', 'status', 'type'].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash);
  } catch { /* ignore */ }
}
