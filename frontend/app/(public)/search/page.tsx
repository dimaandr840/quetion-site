import type { Metadata } from "next";
import {
  fetchProfessions,
  fetchQuestions,
  fetchSearch,
} from "@/lib/content-api";
import {
  parseLevels,
  parseOnlyPopular,
  parseSlugs,
  parseSortOption,
  popularTags,
  professionsWithQuestions,
  questionPath,
  sortQuestions,
} from "@/lib/queries";
import { applyQuestionFilters, buildQuestionFacets } from "@/lib/facets";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { QuestionCard } from "@/components/ui/Cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionFilters } from "@/components/ui/filters/QuestionFilters";
import { ResultsToolbar } from "@/components/ui/filters/ResultsToolbar";
import { SearchBar } from "@/components/ui/SearchBar";
import { Pill } from "@/components/ui/Tag";
import styles from "@/styles/list.module.css";
import { buildMetadata } from "@/lib/seo";

/** Страница рендерится на сервере на каждый запрос — результаты зависят от ?q=. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Результаты поиска",
  description: "Поиск по базе вопросов для собеседований по разным профессиям.",
  path: "/search",
  // Внутренний поиск не должен попадать в индекс.
  noindex: true,
});

interface PageProps {
  searchParams: Promise<{
    q?: string;
    level?: string | string[];
    profession?: string | string[];
    only?: string;
    sort?: string;
  }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const sort = parseSortOption(params.sort);

  const [professionList, allQuestions] = await Promise.all([
    fetchProfessions(),
    fetchQuestions(),
  ]);

  const levels = parseLevels(params.level);
  const professions = parseSlugs(params.profession, professionList);
  const onlyPopular = parseOnlyPopular(params.only);

  // Фасеты строим по релевантной выборке запроса, а не по всей базе:
  // счётчик в фильтре должен совпадать с тем, что увидит пользователь.
  const matchedAll = await fetchSearch(query, {});
  const selection = { levels, professions, onlyPopular };

  const professionOptions = professionsWithQuestions(
    matchedAll.items,
    professionList
  );
  const facets = buildQuestionFacets(
    matchedAll.items,
    selection,
    professionOptions
  );
  const results = sortQuestions(
    applyQuestionFilters(matchedAll.items, selection),
    sort
  );

  // Подсказки нужны именно когда выдача пуста, поэтому берём из всей базы.
  const suggestions = popularTags(allQuestions, 4);

  const professionTitles = Object.fromEntries(
    professionOptions.map((profession) => [profession.slug, profession.title])
  );

  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs
        items={[{ label: "Главная", href: "/" }, { label: "Поиск" }]}
      />

      <div className={styles.head}>
        <h1 className={`h1 ${styles.title}`}>
          {query ? `«${query}»` : "Результаты поиска"}
        </h1>
        <p className={`body-large ${styles.intro}`}>
          {query
            ? "Уточните выдачу фильтрами — ссылку на результат можно скопировать и отправить."
            : "Начните с запроса или сразу сузьте выборку фильтрами."}
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchField}>
          <SearchBar
            placeholder="Искать вопросы или темы..."
            defaultValue={query}
            variant="compact"
          />
        </div>
      </div>

      <div className={styles.layout}>
        <QuestionFilters
          action="/search"
          query={query || undefined}
          levels={levels}
          selectedProfessions={professions}
          onlyPopular={onlyPopular}
          sort={sort}
          facets={facets}
        />

        <div className={styles.content}>
          <ResultsToolbar
            action="/search"
            query={query || undefined}
            levels={levels}
            selectedProfessions={professions}
            onlyPopular={onlyPopular}
            sort={sort}
            matched={results.length}
            total={facets.total}
            professionTitles={professionTitles}
          />

          <div className={styles.results}>
            {results.length > 0 ? (
              results.map((question) => (
                <QuestionCard
                  key={question.slug}
                  question={question}
                  path={questionPath(question)}
                />
              ))
            ) : (
              <EmptyState
                emoji="🔍"
                large
                title={
                  query
                    ? `Ничего не найдено по запросу «${query}»`
                    : "По выбранным фильтрам ничего нет"
                }
                text="Проверьте опечатку или попробуйте одну из тем, которые уже разобраны."
              >
                {suggestions.map((suggestion) => (
                  <Pill
                    key={suggestion}
                    href={`/search?q=${encodeURIComponent(suggestion)}`}
                    size="small"
                  >
                    {suggestion}
                  </Pill>
                ))}
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
