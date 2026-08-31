/**
 * Согласие на необязательные cookie.
 *
 * Решение хранится в cookie, а не в localStorage: само согласие должно
 * исчезать вместе с остальными cookie, когда пользователь чистит их средствами
 * браузера — иначе получится, что отказ от cookie оставляет след помимо воли
 * пользователя. Значение — JSON, потому что кроме самого флага нужны версия
 * набора cookie и момент решения.
 *
 * cookie не httpOnly сознательно: её читает клиентский код, чтобы решить,
 * показывать ли баннер и грузить ли счётчик. Персональных данных в ней нет.
 */

export const CONSENT_COOKIE = "dp_cookie_consent";

/**
 * При изменении состава cookie нужно увеличить версию: старое согласие
 * перестанет считаться действительным и баннер спросит заново (раздел 7 политики).
 */
export const CONSENT_VERSION = 1;

/** Год — срок, указанный в таблице cookie на /privacy. Менять вместе с ней. */
export const CONSENT_MAX_AGE_DAYS = 365;

/** Открыть баннер повторно: кнопка отзыва живёт в другом месте дерева. */
export const CONSENT_OPEN_EVENT = "dp:cookie-settings";

/** Согласие изменилось: подписчики решают, грузить ли счётчик. */
export const CONSENT_CHANGE_EVENT = "dp:cookie-consent-change";

export interface ConsentState {
  version: number;
  analytics: boolean;
  /** ISO-8601: оператор должен уметь подтвердить факт и момент согласия. */
  decidedAt: string;
}

const MAX_AGE_SECONDS = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;

function parseConsent(raw: string): ConsentState | null {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof value !== "object" || value === null) return null;

    const state = value as Partial<ConsentState>;
    if (typeof state.analytics !== "boolean") return null;
    // Согласие на прошлый состав cookie не действует на новый.
    if (state.version !== CONSENT_VERSION) return null;

    return {
      version: CONSENT_VERSION,
      analytics: state.analytics,
      decidedAt: typeof state.decidedAt === "string" ? state.decidedAt : "",
    };
  } catch {
    // Испорченная cookie равносильна отсутствию решения: спросим заново.
    return null;
  }
}

/** Текущее решение пользователя или null, если его ещё не было. */
export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;

  const prefix = `${CONSENT_COOKIE}=`;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return raw ? parseConsent(raw.slice(prefix.length)) : null;
}

/** Записывает решение и сообщает о нём подписчикам. */
export function writeConsent(analytics: boolean): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    analytics,
    decidedAt: new Date().toISOString(),
  };

  if (typeof document !== "undefined") {
    // Secure только по https: иначе браузер откажется ставить cookie
    // на локальном стенде и баннер будет появляться бесконечно.
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const value = encodeURIComponent(JSON.stringify(state));
    document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state }));
  }

  return state;
}

/**
 * Можно ли грузить аналитику. Отсутствие решения — это «нет»: молчание
 * согласием не является.
 */
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

/** Просит баннер показаться снова — для отзыва или изменения согласия. */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
