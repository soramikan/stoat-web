import { createSignal } from "solid-js";

import { registerSW } from "virtual:pwa-register";

const [pendingUpdate, setPendingUpdate] = createSignal<() => void>();

export { pendingUpdate };

function isNativeDesktop() {
  return "native" in window;
}

if (import.meta.env.PROD && isNativeDesktop()) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister()),
        ),
      )
      .catch((error) =>
        console.warn(
          "Failed to unregister service workers in desktop app.",
          error,
        ),
      );
  }

  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch((error) =>
        console.warn(
          "Failed to clear service worker caches in desktop app.",
          error,
        ),
      );
  }
} else if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setPendingUpdate(() => void updateSW(true));
    },
    onOfflineReady() {
      console.info("Ready to work offline =)");
      // toast to users
    },
    onRegistered(r) {
      // registration = r;
      if (!r) return;

      // Check for updates every hour
      setInterval(() => r.update(), 36e5);
    },
  });
}
