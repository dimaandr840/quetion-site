import type { MetadataRoute } from "next";
import {
  fetchCategories,
  fetchProfessions,
  fetchQuestions,
} from "@/lib/content-api";
import { SITE_URL } from "@/lib/site";

/**
 * На сборке (docker build) API недоступен: контейнер api ещё не запущен и сети
 * compose у сборщика нет. Поэтому страница рендерится по запросу, а не
 * пререндерится в образ. Данные при этом всё равно кешируются: в serverFetch
 * у fetch явно задан next.revalidate + тег content, так что база не получает
 * запрос на каждый хит.
 */
export const dynamic = "force-dynamic";

/**
 * Правила гигиены:
 * — в sitemap попадают только страницы с контентом: пустые темы и профессии
 *   без вопросов исключаются (иначе это заявка на soft-404);
 * — priority и changeFrequency убраны: Google их игнорирует;
 * — lastModified ставится только из реальной даты API. Выдуманная дата хуже,
 *   чем её отсутствие: после пары проверок краулер перестаёт ей верить.
 */
type Dated = { updatedAt?: string; publishedAt?: string };

function lastModified(entity: unknown): { lastModified?: Date } {
  const dated = entity as Dated;
  const raw = dated?.updatedAt ?? dated?.publishedAt;
  if (!raw) return {};

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? {} : { lastModified: date };
}

/**
 * Карта сайта не имеет права падать.
 *
 * Раньше три запроса к API шли через Promise.all без обработки ошибок: любой
 * таймаут, 5xx или не поднятый контейнер api превращали /sitemap.xml в 500.
 * Для поисковика 500 на карте сайта неотличим от её отсутствия — и именно
 * так это выглядело в аудите («sitemap недоступен»), хотя маршрут в коде был.
 *
 * Теперь каждый источник грузится независимо, а статические адреса
 * отдаются в любом случае: неполная карта лучше, чем пятисотка.
 */
async function safeList<T>(load: () => Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    console.error(`[sitemap] не удалось загрузить ${label}`, error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // /privacy больше не страница, а редирект на /legal/privacy: адреса со
  // статусом 301 в sitemap держать нельзя.
  const staticPaths = [
    "/",
    "/professions",
    "/questions",
    "/categories",
    "/legal/privacy",
    "/legal/consent",
    "/legal/terms",
    "/legal/cookies",
  ];

  const [professions, categories, questions] = await Promise.all([
    safeList(fetchProfessions, "профессии"),
    safeList(fetchCategories, "темы"),
    safeList(fetchQuestions, "вопросы"),
  ]);

  // Считаем наполнение по факту, а не по questionCount из API: поле опциональное.
  const questionsByProfession = new Map<string, number>();
  const questionsByCategory = new Map<string, number>();

  for (const question of questions) {
    questionsByProfession.set(
      question.professionSlug,
      (questionsByProfession.get(question.professionSlug) ?? 0) + 1
    );
    const key = `${question.professionSlug}/${question.categorySlug}`;
    questionsByCategory.set(key, (questionsByCategory.get(key) ?? 0) + 1);
  }

  return [
    ...staticPaths.map((path) => ({
      url: `${SITE_URL}${path}`,
    })),
    ...professions
      .filter(
        (profession) => (questionsByProfession.get(profession.slug) ?? 0) > 0
      )
      .map((profession) => ({
        url: `${SITE_URL}/professions/${profession.slug}`,
        ...lastModified(profession),
      })),
    ...categories
      .filter(
        (category) =>
          (questionsByCategory.get(
            `${category.professionSlug}/${category.slug}`
          ) ?? 0) > 0
      )
      .map((category) => ({
        url: `${SITE_URL}/professions/${category.professionSlug}/${category.slug}`,
        ...lastModified(category),
      })),
    ...questions.map((question) => ({
      url: `${SITE_URL}/questions/${question.slug}`,
      ...lastModified(question),
    })),
  ];
}
