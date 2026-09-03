/**
 * Сохранение черновиков при истечении сессии.
 *
 * Сценарий, ради которого это нужно: администратор пишет длинный разбор вопроса
 * дольше, чем живёт access-токен. На сохранении прилетает 401, и без черновика
 * текст теряется целиком — потеря работы, а не просто неудобство.
 */

const PREFIX = "dp_draft:";

export const SESSION_EXPIRED_EVENT = "devprep:session-expired";

export interface SessionExpiredDetail {
  /** Путь запроса, который ответил 401. */
  path: string;
  /** Адрес страницы, где это произошло — куда вернуть после повторного входа. */
  returnTo: string;
}

export function saveDraft(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${PREFIX}${key}`,
      JSON.stringify({ savedAt: new Date().toISOString(), value })
    );
  } catch {
    // Переполнение storage не должно ронять форму.
  }
}

export function readDraft<T>(key: string): { savedAt: string; value: T } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as { savedAt: string; value: T };
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // игнорируем
  }
}

/** Вызывается из apiFetch при 401. */
export function notifySessionExpired(detail: SessionExpiredDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, { detail }));
}

/** Подписка для диалога «Сессия истекла». Возвращает функцию отписки. */
export function onSessionExpired(
  handler: (detail: SessionExpiredDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<SessionExpiredDetail>).detail);
  };
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}
