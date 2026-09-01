import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENABLED } from "@/lib/flags";
import { ADMIN_LOGIN_PATH, ADMIN_PATH, PATHNAME_HEADER } from "@/lib/routes";
import { themeInitScript } from "@/lib/theme";

/**
 * В Next.js 16 файловая конвенция `middleware` переименована в `proxy`,
 * а экспортируемая функция должна называться `proxy` (или быть default).
 *
 * Здесь только грубая отсечка неавторизованных: настоящая проверка прав
 * выполняется бэкендом (JWT + ROLE_ADMIN + @PreAuthorize). Cookie `dp_session`
 * читаемая и не является токеном — подделать её можно, но это даёт лишь
 * доступ к пустой оболочке админки, любые данные API вернёт 401/403.
 *
 * Второе назначение файла — Content-Security-Policy с nonce для всего /admin,
 * включая форму входа /admin/login и восстановление /admin/login/reset.
 * Nonce нельзя выдать из nginx (там нет генератора на запрос), поэтому эти
 * маршруты получают CSP отсюда, а публичные страницы — из nginx (и остаются
 * статическими: расширение matcher сделало бы динамическим весь сайт).
 */
const SESSION_HINT_COOKIE = "dp_session";
const CSP_HEADER = "content-security-policy";

/**
 * Источник картинок вопросов лежит на внешнем домене (R2 или CDN), а img-src в CSP
 * разрешает только 'self'. Без этого исключения превью в админке блокируется браузером.
 * Берём только origin: пути в CSP сравниваются как префиксы и лишней точности не дают.
 */
const MEDIA_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

/**
 * Заголовки безопасности для закрытой части. Они важны именно здесь:
 * редиректы на форму входа формирует этот файл, и ответ минует часть цепочки настроек.
 * Страницы админки не должны попадать ни в кэш прокси, ни в индекс поисковиков,
 * ни в историю браузера после выхода.
 */
const SECURITY_HEADERS: Array<[string, string]> = [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "no-referrer"],
  ["x-robots-tag", "noindex, nofollow, noarchive"],
  ["cache-control", "no-store, no-cache, must-revalidate, max-age=0"],
  ["pragma", "no-cache"],
  ["cross-origin-opener-policy", "same-origin"],
  ["cross-origin-resource-policy", "same-origin"],
  // credentialless, а не require-corp: картинки вопросов лежат на домене
  // хранилища, который не присылает Cross-Origin-Resource-Policy, а
  // require-corp блокирует любой кросс-доменный subresource без такого
  // заголовка — превью в редакторе ответа не отображалось бы даже при
  // разрешающем img-src. credentialless запрашивает картинки без cookie и
  // сохраняет изоляцию процесса.
  ["cross-origin-embedder-policy", "credentialless"],
  [
    "permissions-policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  ],
];

function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set(CSP_HEADER, csp);
  for (const [name, value] of SECURITY_HEADERS) {
    response.headers.set(name, value);
  }
  return response;
}

/** Хэш считаем один раз на инстанс: строка скрипта фиксирована на сборке. */
let themeHashPromise: Promise<string> | null = null;

function sha256Base64(value: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(value))
    .then((digest) => btoa(String.fromCharCode(...new Uint8Array(digest))));
}

function getThemeScriptHash(): Promise<string> {
  themeHashPromise ??= sha256Base64(themeInitScript);
  return themeHashPromise;
}

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Инлайновые скрипты гидрации Next.js подписываются nonce автоматически:
 * рендерер вычитывает его из CSP входящего запроса. Наш theme-init-скрипт
 * в <head> рендерится через dangerouslySetInnerHTML и nonce не получает,
 * поэтому он разрешён по хэшу. Наличие nonce/хэша отменяет 'unsafe-inline'.
 * Для style-src 'unsafe-inline' убрать нельзя — его требует next/font.
 */
function buildCsp(nonce: string, themeHash: string): string {
  const imgSrc = ["img-src 'self' data: blob:", MEDIA_ORIGIN]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'sha256-${themeHash}'`,
    "style-src 'self' 'unsafe-inline'",
    imgSrc,
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    // Админка ничего не встраивает и никуда не отправляет отчёты через <a ping>.
    "frame-src 'none'",
    "child-src 'none'",
    "media-src 'none'",
    "prefetch-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const csp = buildCsp(createNonce(), await getThemeScriptHash());

  // /admin/login и /admin/login/reset — единственные адреса внутри /admin,
  // которые доступны без сессии: иначе редирект зациклится сам на себя.
  const isAuthRoute =
    pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`);

  if (AUTH_ENABLED) {
    const hint = request.cookies.get(SESSION_HINT_COOKIE)?.value;

    if (!isAuthRoute && pathname.startsWith(ADMIN_PATH) && hint !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_LOGIN_PATH;
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return applySecurityHeaders(NextResponse.redirect(url), csp);
    }

    // Залогиненного админа со страницы входа отправляем в админку.
    // Страница восстановления сознательно не редиректится: сброс может
    // потребоваться и при живой сессии в другом браузере.
    if (pathname === ADMIN_LOGIN_PATH && hint === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_PATH;
      url.search = "";
      return applySecurityHeaders(NextResponse.redirect(url), csp);
    }
  }

  // Заголовок нужен и на запросе (оттуда рендерер берёт nonce), и на ответе.
  const headers = new Headers(request.headers);
  headers.set(CSP_HEADER, csp);
  // Путь нужен layout’у админки, чтобы не оборачивать форму входа в шапку и меню.
  headers.set(PATHNAME_HEADER, pathname);

  return applySecurityHeaders(NextResponse.next({ request: { headers } }), csp);
}

// /login больше не существует — его нечего обрабатывать в matcher.
export const config = {
  matcher: ["/admin/:path*"],
};
