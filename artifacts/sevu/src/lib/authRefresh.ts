/**
 * Auth Refresh Queue
 *
 * Ensures only ONE /auth/refresh call is in-flight at a time.
 * If multiple requests get 401 simultaneously, they all wait for the same
 * refresh promise — then retry in parallel once the new cookie is set.
 *
 * Multi-tab sync: when this tab logs out (refresh failure), a BroadcastChannel
 * message tells other tabs to clear their auth state too.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** BroadcastChannel key used to notify other tabs of auth events. */
const CHANNEL_NAME = "sevu_auth";
const MSG_LOGGED_OUT = "logged_out";
const MSG_LOGGED_IN = "logged_in";

let _channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME);
  return _channel;
}

/** Broadcast a logout event to all other tabs. */
export function broadcastLogout(): void {
  getChannel()?.postMessage(MSG_LOGGED_OUT);
}

/** Broadcast a login event to all other tabs (optional, for UX). */
export function broadcastLogin(): void {
  getChannel()?.postMessage(MSG_LOGGED_IN);
}

/**
 * Register handlers that fire when another tab sends an auth event.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function onAuthBroadcast(handlers: {
  onLogout?: () => void;
  onLogin?: () => void;
}): () => void {
  const channel = getChannel();
  if (!channel) return () => {};

  const listener = (event: MessageEvent) => {
    if (event.data === MSG_LOGGED_OUT) handlers.onLogout?.();
    if (event.data === MSG_LOGGED_IN) handlers.onLogin?.();
  };

  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}

// ─── Refresh Promise Singleton ────────────────────────────────────────────────

/**
 * If a refresh is already in-flight, this holds the pending promise so all
 * concurrent 401 retries await the SAME call instead of each firing their own.
 */
let _refreshPromise: Promise<boolean> | null = null;

/**
 * Silently refresh the access token using the httpOnly refresh cookie.
 *
 * - Thread-safe: concurrent calls share a single in-flight promise.
 * - Returns `true` if the new access-token cookie was set successfully.
 * - Returns `false` on network error or invalid/expired refresh token.
 */
export async function refreshAccessToken(): Promise<boolean> {
  // Already refreshing — return the same promise to all callers
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return res.ok;
    } catch {
      // Network failure
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}
