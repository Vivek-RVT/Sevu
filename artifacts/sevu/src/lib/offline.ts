/**
 * Offline queue management and auto-sync.
 *
 * Works alongside the service worker:
 *   - SW queues mutations in IndexedDB when offline
 *   - SW sends messages to the page when queue changes / sync completes
 *   - This module subscribes to those messages and exposes reactive state
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: { success: number; failed: number } | null;
}

/* ─── SW message bridge ─────────────────────────────────────────────────────── */

type SwListener = (msg: MessageEvent) => void;
const listeners = new Set<SwListener>();

function notifyListeners(msg: MessageEvent) {
  listeners.forEach((fn) => fn(msg));
}

if (typeof navigator !== "undefined" && navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("message", notifyListeners);
}

export function addSwListener(fn: SwListener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ─── SW communication ──────────────────────────────────────────────────────── */

export function triggerSync() {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: "TRIGGER_SYNC" });
}

export function requestQueueCount() {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: "GET_QUEUE_COUNT" });
}

/* ─── React Query cache persistence (localStorage) ─────────────────────────── */

const CACHE_KEY = "sevu-rq-cache";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function persistCache(data: unknown) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    /* localStorage quota exceeded — ignore */
  }
}

export function restoreCache(): unknown | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/* ─── useOfflineSync hook ───────────────────────────────────────────────────── */

export function useOfflineSync(): SyncState {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const wasOffline = useRef(false);

  /* Handle SW messages */
  useEffect(() => {
    const removeListener = addSwListener((event: MessageEvent) => {
      const msg = event.data;
      if (!msg?.type) return;

      switch (msg.type) {
        case "QUEUE_UPDATED":
          setPendingCount(msg.count ?? 0);
          break;
        case "QUEUE_COUNT":
          setPendingCount(msg.count ?? 0);
          break;
        case "SYNC_START":
          setIsSyncing(true);
          setPendingCount(msg.count ?? 0);
          break;
        case "SYNC_COMPLETE":
          setIsSyncing(false);
          setPendingCount(msg.remaining ?? 0);
          setLastSyncResult({ success: msg.success, failed: msg.failed });
          /* Invalidate all queries so fresh data is fetched */
          queryClient.invalidateQueries();
          /* Clear the "last sync result" badge after 4 s */
          setTimeout(() => setLastSyncResult(null), 4000);
          break;
      }
    });
    return removeListener;
  }, [queryClient]);

  /* Online / offline detection */
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline.current) {
        /* Trigger SW sync for queued mutations */
        triggerSync();
        /* Also invalidate queries to refetch fresh API data */
        queryClient.invalidateQueries();
        wasOffline.current = false;
      }
      /* Ask SW for current queue count */
      requestQueueCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOffline.current = true;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    /* Ask for queue count on mount */
    requestQueueCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [queryClient]);

  return { isOnline, pendingCount, isSyncing, lastSyncResult };
}

/* ─── Global singleton sync state (for NetworkStatus to consume) ──────────── */

type SyncStateListener = (s: SyncState) => void;
const syncStateListeners = new Set<SyncStateListener>();
let globalSyncState: SyncState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncResult: null,
};

export function getSyncState() {
  return globalSyncState;
}

export function subscribeSyncState(fn: SyncStateListener) {
  syncStateListeners.add(fn);
  return () => syncStateListeners.delete(fn);
}

function updateGlobalSyncState(patch: Partial<SyncState>) {
  globalSyncState = { ...globalSyncState, ...patch };
  syncStateListeners.forEach((fn) => fn(globalSyncState));
}

/* Wire up SW messages to global state (runs once at module load) */
if (typeof navigator !== "undefined" && navigator.serviceWorker) {
  addSwListener((event: MessageEvent) => {
    const msg = event.data;
    if (!msg?.type) return;
    switch (msg.type) {
      case "QUEUE_UPDATED":
        updateGlobalSyncState({ pendingCount: msg.count ?? 0 });
        break;
      case "QUEUE_COUNT":
        updateGlobalSyncState({ pendingCount: msg.count ?? 0 });
        break;
      case "SYNC_START":
        updateGlobalSyncState({ isSyncing: true, pendingCount: msg.count ?? 0 });
        break;
      case "SYNC_COMPLETE":
        updateGlobalSyncState({
          isSyncing: false,
          pendingCount: msg.remaining ?? 0,
          lastSyncResult: { success: msg.success, failed: msg.failed },
        });
        break;
    }
  });

  window.addEventListener("online", () =>
    updateGlobalSyncState({ isOnline: true })
  );
  window.addEventListener("offline", () =>
    updateGlobalSyncState({ isOnline: false })
  );
}
