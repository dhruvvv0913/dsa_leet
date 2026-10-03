import { clear, createStore, del, get, set, type UseStore } from "idb-keyval";
import { buildSeed, DEMO_STATE_VERSION, type DemoState } from "./seed";

const STATE_KEY = "dsa-cohort-demo-state";

let memoryState: DemoState | null = null;
let idbStore: UseStore | null = null;
const memoryBlobs = new Map<string, Blob>();

function screenshotsStore() {
  if (typeof indexedDB === "undefined") return null;
  try {
    idbStore ??= createStore("dsa-cohort-demo", "screenshots");
    return idbStore;
  } catch {
    return null;
  }
}

/** Demo data lives in localStorage (falls back to memory in private windows). */
export function loadState(): DemoState {
  if (memoryState) return memoryState;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === DEMO_STATE_VERSION) {
        memoryState = parsed;
        return parsed;
      }
    }
  } catch {
    // unreadable or blocked — start fresh
  }
  memoryState = buildSeed();
  saveState(memoryState);
  return memoryState;
}

export function saveState(state: DemoState) {
  memoryState = state;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: keep working from memory
  }
}

export function resetState(keepPersona: DemoState["persona"]) {
  const fresh = buildSeed();
  fresh.persona = keepPersona;
  saveState(fresh);
  return fresh;
}

export async function putBlob(path: string, blob: Blob) {
  memoryBlobs.set(path, blob);
  const store = screenshotsStore();
  if (!store) return;
  try {
    await set(path, blob, store);
  } catch {
    // memory copy is enough for this tab
  }
}

export async function getBlob(path: string): Promise<Blob | null> {
  const cached = memoryBlobs.get(path);
  if (cached) return cached;
  const store = screenshotsStore();
  if (!store) return null;
  try {
    const blob = (await get(path, store)) as Blob | undefined;
    if (blob) memoryBlobs.set(path, blob);
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteBlob(path: string) {
  memoryBlobs.delete(path);
  const store = screenshotsStore();
  if (!store) return;
  try {
    await del(path, store);
  } catch {
    // ignore
  }
}

export async function clearBlobs() {
  memoryBlobs.clear();
  const store = screenshotsStore();
  if (!store) return;
  try {
    await clear(store);
  } catch {
    // ignore
  }
}
