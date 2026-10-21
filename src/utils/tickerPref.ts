// "Hide the rolling portfolio strip" - a per-workspace display preference stored on this device.
const key = (wsId?: string | null) => `hv_hide_ticker_${wsId || 'none'}`;
export const getHideTicker = (wsId?: string | null): boolean => { try { return localStorage.getItem(key(wsId)) === '1'; } catch { return false; } };
export const setHideTicker = (wsId: string | null | undefined, hide: boolean) => {
  try { hide ? localStorage.setItem(key(wsId), '1') : localStorage.removeItem(key(wsId)); } catch { /* */ }
  try { window.dispatchEvent(new Event('hv-ticker-pref')); } catch { /* */ }
};
