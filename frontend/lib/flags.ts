/**
 * Фичефлаги времени исполнения.
 *
 * Раньше здесь была одна строка с `process.env.NEXT_PUBLIC_AUTH_ENABLED`. Это не флаг,
 * а константа сборки: `NEXT_PUBLIC_*` подставляется в бандл на этапе build, то есть
 * любое переключение требовало пересборки образа и деплоя — постепенная раскатка
 * и быстрое выключение сломавшейся функциональности были невозможны.
 *
 * Теперь источник правды — `GET /api/flags` (таблица `feature_flags` + кэш на сервере).
 * Значения из окружения остаются только как значения по умолчанию на первый рендер
 * и на случай недоступности API: флаги не должны быть точкой отказа.
 */

export type FlagKey =
  | "auth-enabled"
  | "search-index-enabled"
  | "media-enabled"
  | "registration-enabled";

export type Flags = Partial<Record<FlagKey, boolean>> & Record<string, boolean>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const BUCKET_STORAGE_KEY = "dp_flag_bucket";

/**
 * Значения до первого ответа API.
 *
 * Намеренно консервативны: аутентификация по умолчанию включена — потерять защиту
 * из-за сетевой ошибки хуже, чем показать лишнюю форму входа.
 */
const FALLBACK_FLAGS: Flags = {
  "auth-enabled": process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false",
  "search-index-enabled": false,
  "media-enabled": false,
  "registration-enabled": false,
};

/**
 * Совместимость со старым кодом (в том числе с proxy.ts, который работает до гидратации
 * и не может ждать сетевого запроса).
 */
export const AUTH_ENABLED = FALLBACK_FLAGS["auth-enabled"] === true;

let cache: Flags | null = null;
let inflight: Promise<Flags> | null = null;
let loadedAt = 0;

/** Стабильный анонимный идентификатор браузера для процентной раскатки. */
export function flagBucketId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(BUCKET_STORAGE_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    window.localStorage.setItem(BUCKET_STORAGE_KEY, generated);
    return generated;
  } catch {
    // Приватный режим или запрет storage: без идентификатора частичная раскатка
    // считается выключенной, полностью раскатанные флаги работают как обычно.
    return null;
  }
}

/** Текущие значения без сетевого запроса (для первого рендера). */
export function flagsSnapshot(): Flags {
  return cache ?? FALLBACK_FLAGS;
}

export function isFlagEnabled(key: string): boolean {
  return flagsSnapshot()[key] === true;
}

/**
 * Загружает флаги с сервера. Параллельные вызовы схлопываются в один запрос:
 * флаги читаются из многих компонентов одновременно.
 */
export async function loadFlags(options: { force?: boolean } = {}): Promise<Flags> {
  const ttlMs = 15_000;
  const fresh = cache && Date.now() - loadedAt < ttlMs;
  if (fresh && !options.force) return cache as Flags;
  if (inflight) return inflight;

  const bucket = flagBucketId();
  const query = bucket ? `?bucket=${encodeURIComponent(bucket)}` : "";

  inflight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/flags${query}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`flags: ${response.status}`);
      const payload = (await response.json()) as { flags?: Flags };
      cache = { ...FALLBACK_FLAGS, ...(payload.flags ?? {}) };
      loadedAt = Date.now();
      return cache;
    } catch {
      // Недоступность /api/flags не должна ломать страницу.
      return cache ?? FALLBACK_FLAGS;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
