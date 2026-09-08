/**
 * Согласие на необязательные cookie.
 *
 * Сайт работает на аудиторию РФ, поэтому ориентир — 152-ФЗ: cookie
 * считаются персональными данными, если позволяют косвенно идентифицировать
 * посетителя или строить поведенческий профиль, а согласие по ст. 9 должно
 * быть конкретным, информированным и сознательным. Поэтому аналитика
 * подключается только после явного действия пользователя, а отказ должен быть
 * таким же простым, как согласие.
 *
 * Решение хранится вместе с датой и версией политики — это подтверждение
 * согласия. Важное ограничение: хранилище — только браузер посетителя,
 * то есть доказать согласие со стороны оператора пока нечем. Серверный
 * журнал согласий (дата, IP, версия политики) — открытая задача,
 * см. docs/legal-152fz.md.
 *
 * Сама cookie согласия — технически необходимая: без неё негде хранить отказ.
 */

export const CONSENT_COOKIE = "dp_cookie_consent";

/**
 * Поднимается при изменении состава cookie или текста политики.
 * v3 — Google Analytics 4 заменён на Яндекс Метрику: получатель данных
 * другой, значит согласие на прежний состав недействительно и спрашивается заново.
 */
export const CONSENT_VERSION = 3;

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

/**
 * Решение уже зафиксировано? Снимок для useSyncExternalStore: cookie —
 * внешнее по отношению к React состояние, поэтому компоненты читают его
 * через подписку, а не через setState в эффекте.
 */
export function hasStoredConsent(): boolean {
  return readConsent() !== null;
}

/** Подписка на изменение решения (в том числе из другого компонента). */
export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
}

export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
