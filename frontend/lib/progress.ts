/**
 * Прогресс изучения вопросов. Хранится только в браузере: аккаунтов у публичной
 * части нет, а localStorage переживает перезагрузку и не требует запросов к API.
 *
 * Наружу store выдаётся через subscribe/getSnapshot, чтобы компоненты читали его
 * через useSyncExternalStore — так же, как ThemeToggle читает data-theme.
 */

export type QuestionProgress = "known" | "repeat";

const STORAGE_KEY = "devprep-progress";

const listeners = new Set<() => void>();

let cache: Record<string, QuestionProgress> = {};
let cacheRaw: string | null = null;
let cacheValid = false;

function parse(raw: string | null): Record<string, QuestionProgress> {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: Record<string, QuestionProgress> = {};
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === "known" || value === "repeat") result[slug] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Значение кэшируется: getSnapshot вызывается на каждом рендере. */
function readAll(): Record<string, QuestionProgress> {
  if (typeof window === "undefined") return {};

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {};
  }

  if (!cacheValid || raw !== cacheRaw) {
    cacheRaw = raw;
    cache = parse(raw);
    cacheValid = true;
  }

  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Прогресс, изменённый в другой вкладке, должен подхватываться этой. */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
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

export function getProgressSnapshot(slug: string): QuestionProgress | null {
  return readAll()[slug] ?? null;
}

/** На сервере прогресса нет — первый рендер всегда нейтральный. */
export function getProgressServerSnapshot(): null {
  return null;
}

export function setProgress(slug: string, value: QuestionProgress | null) {
  const next = { ...readAll() };
  if (value) {
    next[slug] = value;
  } else {
    delete next[slug];
  }

  try {
    if (Object.keys(next).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Приватный режим или переполнение квоты: отметка живёт до перезагрузки.
  }

  cacheValid = false;
  emit();
}
