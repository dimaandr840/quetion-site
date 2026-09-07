export type QuestionProgress = "known" | "repeat";
const STORAGE_KEY = "devprep-progress";
const listeners = new Set<() => void>();
let cache: Record<string, QuestionProgress> = {};
let cacheRaw: string | null = null;
let cacheValid = false;
let memoryOnly = false;
function parse(raw: string | null): Record<string, QuestionProgress> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v === "known" || v === "repeat"));
  } catch { return {}; }
}
function readAll(): Record<string, QuestionProgress> {
  if (typeof window === "undefined" || memoryOnly) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!cacheValid || raw !== cacheRaw) { cache = parse(raw); cacheRaw = raw; cacheValid = true; }
  } catch { memoryOnly = true; }
  return cache;
}
function emit() { for (const listener of listeners) listener(); }
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  if (memoryOnly) return; // Never overwrite unsaved in-memory progress with stale disk data.
  cacheValid = false;
  emit();
}
export function subscribeProgress(onChange: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}
export function getProgressSnapshot(slug: string): QuestionProgress | null { return readAll()[slug] ?? null; }
export function getProgressServerSnapshot(): null { return null; }
export function setProgress(slug: string, value: QuestionProgress | null) {
  const next = { ...readAll() };
  if (value) next[slug] = value; else delete next[slug];
  // Update memory FIRST. Storage errors must not discard the user's action.
  cache = next;
  cacheValid = true;
  const raw = Object.keys(next).length ? JSON.stringify(next) : null;
  try {
    if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
    cacheRaw = raw;
    memoryOnly = false;
  } catch { memoryOnly = true; }
  emit();
}
