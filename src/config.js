// Firebase web config is public by design (it ships in every web client; access is guarded by App Check).
// Order: build env VITE_FIREBASE_CONFIG (JSON) → committed src/firebase.public.json (project hybrid-ledger-2026, 11/20).
// Without either the app runs in "mock" mode: the UI and ledger work, model calls return a labelled stub.
import committed from "./firebase.public.json" with { type: "json" };

export function loadConfig() {
  const raw = import.meta.env?.VITE_FIREBASE_CONFIG;
  if (raw) {
    try { return { mock: false, firebase: JSON.parse(raw) }; }
    catch { console.warn("VITE_FIREBASE_CONFIG is not valid JSON — using committed config"); }
  }
  if (committed && committed.apiKey && committed.projectId) return { mock: false, firebase: committed };
  return { mock: true };
}
