import type { Level, Profession, QuestionSummary } from "./types";
import { LEVELS } from "./queries";

/**
 * Фасеты фильтра.
 *
 * Правило подсчёта — стандартное для фасетного поиска: счётчик внутри группы
 * считается по выборке, к которой применены ВСЕ фильтры, КРОМЕ этой группы.
 * Иначе выбор «Junior» обнулил бы счётчики Middle/Senior и пользователь
 * потерял бы возможность оценить, что произойдёт при переключении.
 */
export interface LevelFacet {
  value: Level;
  count: number;
}

export interface ProfessionFacet {
  slug: string;
  title: string;
  emoji: string;
  count: number;
}

export interface QuestionFacets {
  levels: LevelFacet[];
  professions: ProfessionFacet[];
  /** Сколько вопросов в разделе всего, без фильтров. */
  total: number;
  /** Сколько останется с текущим набором фильтров. */
  matched: number;
  /** Сколько вопросов помечены как популярные (с учётом остальных фильтров). */
  popular: number;
}

export interface FacetSelection {
  levels: Level[];
  professions?: string[];
  onlyPopular?: boolean;
}

function matchesLevels(question: QuestionSummary, levels: Level[]) {
  return levels.length === 0 || levels.includes(question.level);
}

function matchesProfessions(question: QuestionSummary, slugs: string[]) {
  return slugs.length === 0 || slugs.includes(question.professionSlug);
}

function matchesPopular(question: QuestionSummary, onlyPopular: boolean) {
  return !onlyPopular || Boolean(question.popular);
}

/** Применяет полный набор фильтров — единая точка правды для всех страниц. */
export function applyQuestionFilters(
  items: QuestionSummary[],
  selection: FacetSelection
): QuestionSummary[] {
  const professions = selection.professions ?? [];
  const onlyPopular = Boolean(selection.onlyPopular);

  return items.filter(
    (question) =>
      matchesLevels(question, selection.levels) &&
      matchesProfessions(question, professions) &&
      matchesPopular(question, onlyPopular)
  );
}

export function buildQuestionFacets(
  items: QuestionSummary[],
  selection: FacetSelection,
  professionOptions: Profession[] = []
): QuestionFacets {
  const selectedProfessions = selection.professions ?? [];
  const onlyPopular = Boolean(selection.onlyPopular);

  // Для группы «Сложность» игнорируем выбранные уровни.
  const forLevels = items.filter(
    (question) =>
      matchesProfessions(question, selectedProfessions) &&
      matchesPopular(question, onlyPopular)
  );

  // Для группы «Профессия» игнорируем выбранные профессии.
  const forProfessions = items.filter(
    (question) =>
      matchesLevels(question, selection.levels) &&
      matchesPopular(question, onlyPopular)
  );

  // Для тумблера «Популярные» игнорируем сам тумблер.
  const forPopular = items.filter(
    (question) =>
      matchesLevels(question, selection.levels) &&
      matchesProfessions(question, selectedProfessions)
  );

  const professionCounts = new Map<string, number>();
  for (const question of forProfessions) {
    professionCounts.set(
      question.professionSlug,
      (professionCounts.get(question.professionSlug) ?? 0) + 1
    );
  }

  return {
    levels: LEVELS.map((level) => ({
      value: level,
      count: forLevels.filter((question) => question.level === level).length,
    })),
    professions: professionOptions
      .map((profession) => ({
        slug: profession.slug,
        title: profession.title,
        emoji: profession.emoji,
        count: professionCounts.get(profession.slug) ?? 0,
      }))
      // Сначала то, что реально даст результат: 0 — всегда внизу.
      .sort(
        (a, b) =>
          b.count - a.count || a.title.localeCompare(b.title, "ru")
      ),
    total: items.length,
    matched: applyQuestionFilters(items, selection).length,
    popular: forPopular.filter((question) => Boolean(question.popular)).length,
  };
}
