export type Level = "Junior" | "Middle" | "Senior";

export interface CodeSample {
  language: string;
  title: string;
  lines: string[];
}

export interface AnswerSection {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: CodeSample;
}

/** Практическое задание: то, что нельзя проверить пересказом теории. */
export interface PracticeTask {
  id: string;
  title: string;
  statement: string[];
  hint?: string;
}

/**
 * Картинка вопроса.
 *
 * `storageKey` — ключ объекта в хранилище и единственное, что отправляется на запись;
 * `url` всегда приходит от бэкенда и зависит от того, какой домен настроен в момент запроса.
 * `width`/`height` нужны next/image, чтобы вёрстка не прыгала при загрузке.
 */
export interface QuestionImage {
  storageKey: string;
  url?: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * Вопрос в списках: то, что отдаёт QuestionSummaryDto. Без тела ответа.
 * `path` («Профессия > Специализация > Тема») считает бэкенд.
 */
export interface QuestionSummary {
  slug: string;
  title: string;
  level: Level;
  professionSlug: string;
  categorySlug: string;
  tags: string[];
  snippet: string;
  tldr: string;
  popular?: boolean;
  path?: string;
}

export interface Question extends QuestionSummary {
  sections: AnswerSection[];
  tasks?: PracticeTask[];
  images?: QuestionImage[];
  published?: boolean;
  /** Соседи и похожие приходят вместе с вопросом: QuestionDetailDto. */
  related?: QuestionSummary[];
  previous?: QuestionSummary;
  next?: QuestionSummary;
}

/**
 * Тема — самый нижний уровень группировки перед вопросами.
 * Исторически называется Category: так её знают роуты, sitemap и админка.
 */
export interface Category {
  slug: string;
  emoji: string;
  title: string;
  description: string;
  professionSlug: string;
  specializationSlug: string;
  /** Приходит из API; в content.ts (сид) не указывается. */
  questionCount?: number;
}

/**
 * Специализация — направление внутри профессии (Frontend Developer → JavaScript).
 * Уровень группирующий: у него нет отдельного URL, он объединяет темы
 * на странице профессии и в хлебных крошках.
 */
export interface Specialization {
  slug: string;
  professionSlug: string;
  title: string;
  description: string;
  questionCount?: number;
}

/** Сфера — верхний уровень: IT, Дизайн, Маркетинг и другие. */
export interface Industry {
  slug: string;
  emoji: string;
  title: string;
  description: string;
}

export interface Profession {
  slug: string;
  emoji: string;
  title: string;
  pageTitle: string;
  description: string;
  cardDescription: string;
  industrySlug: string;
  /** Показывать в блоке «Популярные профессии» на главной. */
  featured?: boolean;
  questionCount?: number;
}

export type SortOption = "popular" | "level" | "alpha";
