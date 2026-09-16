// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Cross-tab store sync
// Zustand's `persist` middleware writes to localStorage on every change, but it
// does NOT automatically pull changes made by *other* tabs back into a running
// tab's state. That's exactly what we need here: a customer transferring money
// in one tab and an admin approving/denying it in another must see each other's
// updates live. We listen for the browser's `storage` event (fired in every
// tab except the one that wrote the value) and ask the store to re-read
// whatever's currently in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

interface PersistApi {
  persist: { rehydrate: () => Promise<void> | void };
}

/**
 * Wires up automatic cross-tab rehydration for a zustand store created with
 * the `persist` middleware. Call once per store, right after creating it.
 */
export function syncStoreAcrossTabs(storageKey: string, store: PersistApi): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) {
      store.persist.rehydrate();
    }
  });
}
