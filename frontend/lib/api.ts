/**
 * Клиентский слой доступа к API.
 *
 * Токены живут только в httpOnly-cookie, поэтому JS их не читает и не пишет:
 * все запросы идут с `credentials: "include"`, а защита от CSRF —
 * double-submit cookie: Spring Security кладёт читаемую cookie `XSRF-TOKEN`,
 * мы возвращаем её значение в заголовке `X-XSRF-TOKEN`.
 */

import { notifySessionExpired } from "./session-recovery";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    message: string,
    options: { detail?: string; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = options.detail;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

/**
 * Единственный незавершённый запрос токена.
 *
 * Без него параллельные мутации (например, массовое действие в админке или
 * два submit подряд) каждая дергали `/auth/csrf`: сookies ещё нет, проверка
 * `readCookie` у всех проваливается одновременно, и на сервер уходит N
 * одинаковых запросов. Лишняя нагрузка — меньшая из проблем: каждый ответ
 * перезаписывает cookie новым токеном, поэтому запрос, успевший прочитать
 * предыдущее значение, отправляет уже недействительный заголовок и получает
 * 403 на ровном месте.
 */
let csrfRequest: Promise<string | null> | null = null;

/** Инициирует выдачу cookie `XSRF-TOKEN`, если её ещё нет. */
async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  // Промис снимается в finally, а не после await: иначе при ошибке сети
  // ссылка осталась бы навсегда и все последующие мутации переиспользовали
  // бы уже отклонённый промис.
  csrfRequest ??= (async () => {
    try {
      await fetch(`${API_BASE}/auth/csrf`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      return readCookie(CSRF_COOKIE);
    } finally {
      csrfRequest = null;
    }
  })();

  return csrfRequest;
}

interface ProblemDetail {
  title?: string;
  detail?: string;
  retryAfterSeconds?: number;
}

/** Сколько ждать до повтора, с учётом стандартного заголовка Retry-After. */
function retryAfterFrom(response: Response, problem: ProblemDetail): number | undefined {
  if (typeof problem.retryAfterSeconds === "number") {
    return problem.retryAfterSeconds;
  }
  const header = response.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetail = {};
  try {
    problem = (await response.json()) as ProblemDetail;
  } catch {
    // Тело может быть пустым (например, 204/502) — оставляем дефолтное сообщение.
  }

  const message =
    problem.detail || problem.title || `Ошибка запроса (${response.status})`;
  return new ApiError(response.status, message, {
    detail: problem.detail,
    retryAfterSeconds: retryAfterFrom(response, problem),
  });
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  // FormData исключён сознательно: его Content-Type содержит сгенерированный
  // браузером boundary. Стоит выставить заголовок вручную — boundary потеряется,
  // и сервер ответит непонятной ошибкой разбора multipart.
  if (
    init.body !== undefined &&
    !headers.has("Content-Type") &&
    !(typeof FormData !== "undefined" && init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (UNSAFE_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    if (token) headers.set(CSRF_HEADER, token);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  // Истечение сессии посреди работы — не рядовая ошибка формы: без отдельного
  // сигнала интерфейс показывал бы «Ошибка запроса (401)» и терял введённый текст.
  if (response.status === 401 && typeof window !== "undefined") {
    notifySessionExpired({
      path,
      returnTo: `${window.location.pathname}${window.location.search}`,
    });
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204 || response.headers.get("Content-Length") === "0") {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("json")) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Загрузка файла через multipart/form-data.
 *
 * Отдельная функция, а не вызов apiFetch на месте: потребителям не нужно помнить
 * про запрет на ручной Content-Type.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: formData });
}

/** Человеческий текст для 429/503 с retryAfterSeconds. */
export function retryAfterMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.retryAfterSeconds === undefined) {
    return null;
  }
  const seconds = Math.max(1, Math.ceil(error.retryAfterSeconds));
  if (seconds < 60) {
    return `Повторите попытку через ${seconds} сек.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Повторите попытку через ${minutes} мин.`;
}
