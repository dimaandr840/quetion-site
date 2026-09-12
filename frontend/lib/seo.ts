/**
 * Сборка метаданных страницы: canonical + Open Graph в одном месте.
 *
 * Главное правило: canonical всегда указывает на чистый путь без параметров
 * ?level, ?sort, ?page, ?profession — именно они создают дубли в индексе.
 *
 * Картинки для шеринга (og:image / twitter:image) намеренно не задаются, и
 * twitter-карточка не объявляется вовсе: card="summary_large_image" без
 * картинки давал пустую рамку в Telegram, VK и LinkedIn. Соцсети в этом случае
 * строят превью из title + description Open Graph. Если превью с картинкой
 * понадобится, добавлять нужно обе части сразу — и card, и сам og:image.
 */
import type { Metadata } from "next";
import {
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  absoluteUrl,
} from "./site";

export interface SeoInput {
  /** Заголовок без суффикса бренда — шаблон добавит его сам. */
  title?: string;
  description?: string;
  /** Чистый путь без query-параметров, например "/questions". */
  path: string;
  /** Страницы без самостоятельной ценности для поиска (внутренний поиск). */
  noindex?: boolean;
  /** Для страниц с текстом ответа вместо листинга. */
  type?: "website" | "article";
}

export function buildMetadata({
  title,
  description,
  path,
  noindex,
  type = "website",
}: SeoInput): Metadata {
  const url = absoluteUrl(path);
  const resolvedDescription = description ?? SITE_DESCRIPTION;

  return {
    ...(title ? { title } : {}),
    description: resolvedDescription,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      ...(title ? { title: `${title} | ${SITE_NAME}` } : {}),
      description: resolvedDescription,
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Для страниц 404-типа (вопрос/тема не найдены): не индексируем. */
export function notFoundMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
