/**
 * Клиентский слой доступа к API.
 *
 * Токены живут только в httpOnly-cookie, поэтому JS их не читает и не пишет:
 * все запросы идут с `credentials: "include"`, а защита от CSRF —
 * double-submit cookie: Spring Security кладёт читаемую cookie `XSRF-TOKEN`,
 * мы возвращаем её значение в заголовке `X-XSRF-TOKEN`.
 */

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

/** Инициирует выдачу cookie `XSRF-TOKEN`, если её ещё нет. */
async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  await fetch(`${API_BASE}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  return readCookie(CSRF_COOKIE);
}

interface ProblemDetail {
  title?: string;
  detail?: string;
  retryAfterSeconds?: number;
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
    retryAfterSeconds: problem.retryAfterSeconds,
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
