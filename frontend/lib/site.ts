/**
 * Абсолютный адрес сайта.
 *
 * Нужен для canonical, Open Graph, JSON-LD, robots.txt и sitemap.xml.
 * В production обязательно задать NEXT_PUBLIC_SITE_URL: без него все
 * абсолютные адреса уедут на localhost, а sitemap станет бесполезным.
 */
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim();

/** Фолбэк только для локальной разработки. */
const FALLBACK_SITE_URL = "http://localhost:3000";

if (!RAW_SITE_URL && process.env.NODE_ENV === "production") {
  // Не роняем контейнер, но оставляем громкий след в логах сборки и рантайма.
  console.warn(
    `[seo] NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на ${FALLBACK_SITE_URL}`
  );
}

export const SITE_URL = (RAW_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, "");

/** true, если реальный домен так и не задан. */
export const SITE_URL_IS_FALLBACK = !RAW_SITE_URL;

export const SITE_NAME = "DevPrep";

export const SITE_DESCRIPTION =
  "Разборы вопросов с IT-собеседований: короткий ответ, подробное объяснение и примеры кода по Java, Frontend, Backend, DevOps, QA и Python.";

export const SITE_LOCALE = "ru_RU";

/** Абсолютный URL для относительного пути: absoluteUrl("/questions"). */
export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
