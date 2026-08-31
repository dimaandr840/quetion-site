/**
 * Согласие на необязательные cookie.
 *
 * По 152-ФЗ аналитические и рекламные идентификаторы ставятся только после
 * явного действия пользователя, поэтому решение хранится вместе с датой и
 * версией политики: это доказательство при проверке. При смене версии
 * согласие спрашивается заново.
 *
 * Сама cookie согласия — технически необходимая: без неё негде хранить отказ.
 */

export const CONSENT_COOKIE = "dp_cookie_consent";

/** Поднимается при изменении состава cookie или текста политики. */
export const CONSENT_VERSION = 1;

const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Открыть настройки заново (ссылка в подвале). */
export const CONSENT_OPEN_EVENT = "dp:cookie-settings";

/** Решение пользователя изменилось — сюда подключается загрузка метрики. */
export const CONSENT_CHANGE_EVENT = "dp:cookie-consent-change";

export interface ConsentState {
  version: number;
  /** Аналитика и любые другие необязательные сценарии. */
  analytics: boolean;
  /** ISO-дата решения. */
  decidedAt: string;
}

export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;

  const prefix = `${CONSENT_COOKIE}=`;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));

  if (!raw) return null;

  try {
    const parsed = JSON.parse(
      decodeURIComponent(raw.slice(prefix.length))
    ) as ConsentState;

    // Старая версия согласия не считается согласием на новый состав cookie.
    if (parsed?.version !== CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== "boolean") return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(analytics: boolean): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    analytics,
    decidedAt: new Date().toISOString(),
  };

  if (typeof document !== "undefined") {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = [
      `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(state))}`,
      "Path=/",
      `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
      "SameSite=Lax",
    ].join("; ") + secure;

    window.dispatchEvent(
      new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state })
    );
  }

  return state;
}

/** Главная проверка перед загрузкой любого счётчика. */
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
