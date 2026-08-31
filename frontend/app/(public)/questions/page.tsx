import type { Metadata } from "next";
import { fetchProfessions, fetchQuestions } from "@/lib/content-api";
import {
  parseLevels,
  parseOnlyPopular,
  parseSlugs,
  parseSortOption,
  professionsWithQuestions,
  questionPath,
  sortQuestions,
} from "@/lib/queries";
import { applyQuestionFilters, buildQuestionFacets } from "@/lib/facets";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { QuestionCard } from "@/components/ui/Cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { QuestionFilters } from "@/components/ui/filters/QuestionFilters";
import { ResultsToolbar } from "@/components/ui/filters/ResultsToolbar";
import { SearchBar } from "@/components/ui/SearchBar";
import styles from "@/styles/list.module.css";
import { buildMetadata } from "@/lib/seo";

/**
 * На сборке (docker build) API недоступен: контейнер api ещё не запущен и сети
 * compose у сборщика нет. Поэтому страница рендерится по запросу, а не
 * пререндерится в образ. Данные при этом всё равно кешируются: в serverFetch
 * у fetch явно задан next.revalidate + тег content, так что база не получает
 * запрос на каждый хит.
 */
export const dynamic = "force-dynamic";

/** Сколько вопросов показываем на одной странице базы. */
const PAGE_SIZE = 10;

export const metadata: Metadata = buildMetadata({
  title: "База вопросов",
  description:
    "Все вопросы для подготовки к собеседованию: разборы, примеры и практические задания по разным профессиям и специализациям.",
  path: "/questions",
});

interface PageProps {
  searchParams: Promise<{
    level?: string | string[];
    profession?: string | string[];
    only?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function QuestionsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [allQuestions, professionList] = await Promise.all([
    fetchQuestions(),
    fetchProfessions(),
  ]);

  const levels = parseLevels(params.level);
  const professions = parseSlugs(params.profession, professionList);
  const onlyPopular = parseOnlyPopular(params.only);
  const sort = parseSortOption(params.sort);

  const professionOptions = professionsWithQuestions(
    allQuestions,
    professionList
  );

  const selection = { levels, professions, onlyPopular };

  // Счётчики считаются до отрисовки: фильтр показывает результат до клика.
  const facets = buildQuestionFacets(allQuestions, selection, professionOptions);
  const filtered = sortQuestions(
    applyQuestionFilters(allQuestions, selection),
    sort
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(
    Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1),
    totalPages
  );
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const professionTitles = Object.fromEntries(
    professionOptions.map((profession) => [profession.slug, profession.title])
  );

  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs
        items={[{ label: "Главная", href: "/" }, { label: "Вопросы" }]}
      />

      <div className={styles.head}>
        <h1 className={`h1 ${styles.title}`}>База вопросов</h1>
        {/* Аббревиатура TL;DR убрана из описания: она непонятна части
            пользователей, а блока TL;DR на странице вопроса больше нет. */}
        <p className={`body-large ${styles.intro}`}>
          Все вопросы из всех профессий в одном списке: краткая суть,
          развёрнутые ответы, примеры и практические задания.
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchField}>
          <SearchBar placeholder="Поиск по вопросам..." variant="compact" />
        </div>
      </div>

      <div className={styles.layout}>
        <QuestionFilters
          action="/questions"
          levels={levels}
          selectedProfessions={professions}
          onlyPopular={onlyPopular}
          sort={sort}
          facets={facets}
        />

        <div className={styles.content}>
          <ResultsToolbar
            action="/questions"
            levels={levels}
            selectedProfessions={professions}
            onlyPopular={onlyPopular}
            sort={sort}
            matched={filtered.length}
            total={facets.total}
            professionTitles={professionTitles}
          />

          <div className={styles.results}>
            {visible.length > 0 ? (
              visible.map((question) => (
                <QuestionCard
                  key={question.slug}
                  question={question}
                  path={questionPath(question)}
                />
              ))
            ) : (
              <EmptyState
                emoji="🗂️"
                large
                title="По выбранным фильтрам ничего нет"
                text="Снимите часть условий — например, оставьте только профессию или только уровень."
              />
            )}
          </div>

          <Pagination
            basePath="/questions"
            currentPage={currentPage}
            totalPages={totalPages}
            extraParams={{
              level: levels,
              profession: professions,
              only: onlyPopular ? "popular" : undefined,
              sort: sort === "popular" ? undefined : sort,
            }}
          />
        </div>
      </div>
    </div>
  );
}
