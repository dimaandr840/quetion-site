/**
 * Абсолютный адрес сайта.
 *
 * Нужен для canonical, Open Graph, JSON-LD, robots.txt и sitemap.xml.
 * В production лучше задать NEXT_PUBLIC_SITE_URL явно: тогда адрес не зависит
 * от кода. Если переменной нет, используется рабочий домен проекта.
 */
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim();

/** Рабочий домен проекта — фолбэк для production-сборки. */
const PRODUCTION_SITE_URL = "https://qareerquest.com";

/** Фолбэк только для локальной разработки. */
const DEV_SITE_URL = "http://localhost:3000";

const FALLBACK_SITE_URL =
  process.env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : DEV_SITE_URL;

if (!RAW_SITE_URL && process.env.NODE_ENV === "production") {
  // Не роняем контейнер, но оставляем след в логах сборки и рантайма.
  console.warn(
    `[seo] NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на ${FALLBACK_SITE_URL}`
  );
}

export const SITE_URL = (RAW_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, "");

/** true, если реальный домен так и не задан переменной окружения. */
export const SITE_URL_IS_FALLBACK = !RAW_SITE_URL;

export const SITE_NAME = "Qareer Quest";

/** Домен без схемы — для подписей, писем и футера. */
export const SITE_DOMAIN = "qareerquest.com";

/** Адрес для обратной связи. */
export const SITE_CONTACT_EMAIL = "hello@qareerquest.com";

export const SITE_DESCRIPTION =
  "Разборы вопросов с собеседований: короткий ответ, подробное объяснение и практические задания по IT, дизайну, маркетингу, продукту, финансам и HR.";

export const SITE_LOCALE = "ru_RU";

/** Абсолютный URL для относительного пути: absoluteUrl("/questions"). */
export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
