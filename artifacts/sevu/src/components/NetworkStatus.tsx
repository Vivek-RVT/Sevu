import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { subscribeSyncState, getSyncState, triggerSync, type SyncState } from "@/lib/offline";

type BannerMode = "offline" | "syncing" | "synced" | "back-online" | "hidden";

export function NetworkStatus() {
  const [syncState, setSyncState] = useState<SyncState>(getSyncState);
  const [mode, setMode] = useState<BannerMode>("hidden");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevOnline = useRef(getSyncState().isOnline);

  const scheduleHide = (ms: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setMode("hidden"), ms);
  };

  useEffect(() => {
    const unsub = subscribeSyncState((s) => {
      setSyncState(s);

      if (!s.isOnline) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setMode("offline");
        prevOnline.current = false;
        return;
      }

      if (s.isSyncing) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setMode("syncing");
        prevOnline.current = true;
        return;
      }

      if (s.lastSyncResult) {
        setMode("synced");
        scheduleHide(4000);
        prevOnline.current = true;
        return;
      }

      if (s.isOnline && !prevOnline.current) {
        setMode("back-online");
        scheduleHide(3000);
        prevOnline.current = true;
        return;
      }

      prevOnline.current = s.isOnline;
    });

    return () => {
      unsub();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (mode === "hidden") return null;

  return (
    <div className="fixed top-4 inset-x-4 z-[150] max-w-sm mx-auto animate-in slide-in-from-top-4 duration-300">
      {mode === "offline" && (
        <div className="bg-destructive text-destructive-foreground rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <WifiOff className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Offline mode</p>
            {syncState.pendingCount > 0 && (
              <p className="text-xs opacity-80">
                {syncState.pendingCount} action{syncState.pendingCount !== 1 ? "s" : ""} will sync when reconnected
              </p>
            )}
          </div>
          {syncState.pendingCount > 0 && (
            <span className="bg-white/20 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">
              {syncState.pendingCount}
            </span>
          )}
        </div>
      )}

      {mode === "syncing" && (
        <div className="bg-primary text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Syncing…</p>
            {syncState.pendingCount > 0 && (
              <p className="text-xs opacity-80">
                Uploading {syncState.pendingCount} pending action{syncState.pendingCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {mode === "synced" && syncState.lastSyncResult && (
        <div className="bg-green-500 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {syncState.lastSyncResult.success} action{syncState.lastSyncResult.success !== 1 ? "s" : ""} synced ✓
            </p>
            {syncState.lastSyncResult.failed > 0 && (
              <p className="text-xs opacity-80">
                {syncState.lastSyncResult.failed} failed — tap to retry
              </p>
            )}
          </div>
          {syncState.lastSyncResult.failed > 0 && (
            <button
              onClick={triggerSync}
              className="text-xs font-bold underline opacity-80 hover:opacity-100 shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {mode === "back-online" && (
        <div className="bg-green-500 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <Wifi className="w-4 h-4 shrink-0" />
          <p className="text-sm font-semibold">Back online ✓</p>
        </div>
      )}
    </div>
  );
}
