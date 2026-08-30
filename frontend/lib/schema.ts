/**
 * JSON-LD для сайта.
 *
 * Сознательно НЕ используем FAQPage и QAPage:
 * — FAQ-сниппет Google перестал показывать с 7 мая 2026 года;
 * — QAPage описывает страницы с ответами пользователей, а здесь редакционные разборы.
 * Работают и дают эффект: Organization, WebSite, BreadcrumbList, TechArticle.
 */
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "./site";
import type { Question } from "./types";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icon.svg"),
    },
  };
}

function webSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "ru-RU",
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Граф сайта — отдаётся один раз в корневом layout. */
export function siteSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationSchema(), webSiteSchema()],
  };
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** BreadcrumbList для уже существующих визуальных крошек. */
export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

/**
 * Страница вопроса — редакционный технический материал.
 * Даты и автор подставляются только если реально пришли из API:
 * выдуманная дата в разметке — нарушение правил Google.
 */
export function questionSchema(
  question: Question,
  options: { path: string; sectionName?: string }
) {
  const url = absoluteUrl(options.path);
  const meta = question as Question & {
    author?: string;
    publishedAt?: string;
    updatedAt?: string;
  };

  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${url}#article`,
    headline: question.title,
    description: question.tldr,
    url,
    inLanguage: "ru-RU",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(options.sectionName ? { articleSection: options.sectionName } : {}),
    ...(question.tags.length > 0 ? { keywords: question.tags.join(", ") } : {}),
    ...(meta.author
      ? { author: { "@type": "Person", name: meta.author } }
      : {}),
    ...(meta.publishedAt ? { datePublished: meta.publishedAt } : {}),
    ...(meta.updatedAt ? { dateModified: meta.updatedAt } : {}),
    proficiencyLevel: question.level,
  };
}

/** Листинг вопросов темы — помогает AI-поиску понять структуру страницы. */
export function itemListSchema(
  items: Array<{ title: string; path: string }>,
  name: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: absoluteUrl(item.path),
    })),
  };
}
