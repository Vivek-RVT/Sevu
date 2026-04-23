import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { setRefreshHandler, setOnAuthFailed } from "@workspace/api-client-react";
import {
  refreshAccessToken,
  onAuthBroadcast,
  broadcastLogout,
} from "@/lib/authRefresh";

interface AuthContextValue {
  isAuthenticated: boolean;
  businessId: number | null;
  isLoading: boolean;
  setAuthenticated: (businessId: number | null) => void;
  logout: (revokeAll?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Silently renew the access token cookie via the refresh endpoint.
 * Returns businessId if authenticated, null otherwise.
 */
async function callRefresh(): Promise<{ businessId: number | null } | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { businessId: data.businessId ?? null };
  } catch {
    return null;
  }
}

/** Access token refresh interval — 12 minutes (access token lives 15 min). */
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [businessId, setBusinessId] = useState<number | null>(() => {
    const stored = localStorage.getItem("sevuBusinessId");
    return stored ? parseInt(stored, 10) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Logout (shared between user-initiated and forced logout) ────────────────
  const performLogout = useCallback(async (revokeAll = false, notify = true) => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);

    try {
      await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeAll }),
      });
    } catch {
      /* best effort */
    }

    setIsAuthenticated(false);
    setBusinessId(null);
    localStorage.removeItem("sevuBusinessId");
    localStorage.removeItem("sevuAuthToken");
    localStorage.removeItem("sevuAuthPhone");

    // Tell other tabs to also log out
    if (notify) broadcastLogout();
  }, []);

  // ── Register refresh + auth-failed handlers with the global fetch wrapper ──
  useEffect(() => {
    // The refresh handler is the singleton queue from authRefresh.ts.
    // All concurrent 401s await the same in-flight refresh promise.
    setRefreshHandler(refreshAccessToken);

    // When refresh fails (session expired / token stolen), force logout.
    setOnAuthFailed(() => {
      performLogout(false, true);
    });

    return () => {
      setRefreshHandler(null);
      setOnAuthFailed(null);
    };
  }, [performLogout]);

  // ── Multi-tab logout sync via BroadcastChannel ──────────────────────────────
  useEffect(() => {
    const unsub = onAuthBroadcast({
      onLogout: () => {
        // Another tab logged out — clear state locally without broadcasting again
        if (refreshTimer.current) clearInterval(refreshTimer.current);
        setIsAuthenticated(false);
        setBusinessId(null);
        localStorage.removeItem("sevuBusinessId");
      },
    });
    return unsub;
  }, []);

  // ── Auto-refresh timer ──────────────────────────────────────────────────────
  const startAutoRefresh = useCallback(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(async () => {
      const result = await callRefresh();
      if (result) {
        if (result.businessId !== null) {
          setBusinessId(result.businessId);
          localStorage.setItem("sevuBusinessId", String(result.businessId));
        }
      } else {
        // Refresh failed during the timer — session expired
        performLogout(false, true);
      }
    }, REFRESH_INTERVAL_MS);
  }, [performLogout]);

  // ── On mount: restore session via httpOnly refresh cookie ──────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await callRefresh();
      if (cancelled) return;
      if (result) {
        setIsAuthenticated(true);
        if (result.businessId !== null) {
          setBusinessId(result.businessId);
          localStorage.setItem("sevuBusinessId", String(result.businessId));
        }
        startAutoRefresh();
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem("sevuBusinessId");
        localStorage.removeItem("sevuAuthToken");
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [startAutoRefresh]);

  // ── Called by login / register / reset-password handlers ───────────────────
  const setAuthenticated = useCallback(
    (newBusinessId: number | null) => {
      setIsAuthenticated(true);
      setBusinessId(newBusinessId);
      if (newBusinessId !== null) {
        localStorage.setItem("sevuBusinessId", String(newBusinessId));
      }
      startAutoRefresh();
    },
    [startAutoRefresh],
  );

  const logout = useCallback(
    (revokeAll = false) => performLogout(revokeAll, true),
    [performLogout],
  );

  return (
    <AuthContext.Provider value={{ isAuthenticated, businessId, isLoading, setAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
