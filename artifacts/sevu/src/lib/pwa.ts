/* PWA Service Worker registration + update detection */

type UpdateCallback = () => void;

let updateCallback: UpdateCallback | null = null;

export function onPwaUpdate(cb: UpdateCallback) {
  updateCallback = cb;
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      /* Check for updates every 60 seconds while app is open */
      setInterval(() => registration.update(), 60_000);

      /* Detect when a new SW finishes installing */
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            /* A new version is ready — notify the app */
            updateCallback?.();
          }
        });
      });

      /* Handle controller change — reload once the new SW has taken over */
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    } catch (err) {
      console.warn("[PWA] Service worker registration failed:", err);
    }
  });
}

export function applyPwaUpdate() {
  navigator.serviceWorker.ready.then((registration) => {
    const worker =
      registration.waiting || registration.installing || registration.active;
    worker?.postMessage({ type: "SKIP_WAITING" });
  });
}
