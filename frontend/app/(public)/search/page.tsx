import type { Metadata } from "next";
import { fetchProfessions } from "@/lib/content-api";
import { fetchSearchPage } from "@/lib/search-api";
import { LEVELS, parseLevels, parseOnlyPopular, parseSlugs, parseSortOption, questionPath } from "@/lib/queries";
import type { QuestionFacets } from "@/lib/facets";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { QuestionCard } from "@/components/ui/Cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionFilters } from "@/components/ui/filters/QuestionFilters";
import { ResultsToolbar } from "@/components/ui/filters/ResultsToolbar";
import { SearchBar } from "@/components/ui/SearchBar";
import { Pagination } from "@/components/ui/Pagination";
import { Pill } from "@/components/ui/Tag";
import { DegradedSearchBanner } from "@/components/search/DegradedSearchBanner";
import { buildMetadata } from "@/lib/seo";
import styles from "@/styles/list.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildMetadata({ title: "Результаты поиска",
  description: "Поиск по базе вопросов для собеседований по разным профессиям.", path: "/search", noindex: true });

interface PageProps {
  searchParams: Promise<{ q?: string; level?: string | string[]; profession?: string | string[];
    only?: string; sort?: string; page?: string }>;
}
export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const sort = parseSortOption(params.sort);
  const professionList = await fetchProfessions();
  const levels = parseLevels(params.level);
  const professions = parseSlugs(params.profession, professionList);
  const onlyPopular = parseOnlyPopular(params.only);
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 2147483647) : 1;
  const result = await fetchSearchPage(query, { levels, professions, onlyPopular, sort, page });
  const facets: QuestionFacets = {
    levels: LEVELS.map(value => ({ value, count: result.levelCounts[value] ?? 0 })),
    professions: result.professionCounts,
    total: result.unfilteredTotal, matched: result.total, popular: result.popularCount,
  };
  const professionTitles = Object.fromEntries(professionList.map(p => [p.slug, p.title]));
  const clearHref = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
  const hasFilters = levels.length > 0 || professions.length > 0 || onlyPopular;
  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Поиск" }]} />
      <div className={styles.head}>
        <h1 className={`h1 ${styles.title}`}>{query ? `«${query}»` : "Результаты поиска"}</h1>
        <p className={`body-large ${styles.intro}`}>Уточните выдачу фильтрами — ссылку на результат можно скопировать и отправить.</p>
      </div>
      <DegradedSearchBanner degraded={result.degraded} />
      <div className={styles.toolbar}><div className={styles.searchField}>
        <SearchBar key={query} placeholder="Искать вопросы или темы..." defaultValue={query} variant="compact" />
      </div></div>
      <div className={styles.layout}>
        <QuestionFilters action="/search" query={query || undefined} levels={levels}
          selectedProfessions={professions} onlyPopular={onlyPopular} sort={sort} facets={facets} />
        <div className={styles.content}>
          <ResultsToolbar action="/search" query={query || undefined} levels={levels}
            selectedProfessions={professions} onlyPopular={onlyPopular} sort={sort}
            matched={result.total} total={result.unfilteredTotal} professionTitles={professionTitles} />
          <div className={styles.results}>
            {result.items.length ? result.items.map(question => (
              <QuestionCard key={question.slug} question={question} path={questionPath(question)} />
            )) : (
              <EmptyState emoji="🔍" large title="Ничего не найдено"
                text={hasFilters ? "Попробуйте снять фильтры, сохранив поисковый запрос." : "Измените запрос или откройте каталог вопросов."}>
                {hasFilters && <Pill href={clearHref}>Снять фильтры</Pill>}
                <Pill href="/questions">Все вопросы</Pill>
              </EmptyState>
            )}
          </div>
          <Pagination basePath="/search" currentPage={result.page + 1}
            totalPages={Math.ceil(result.total / result.size)}
            extraParams={{ q: query || undefined, level: levels, profession: professions,
              only: onlyPopular ? "popular" : undefined, sort: sort === "popular" ? undefined : sort }} />
        </div>
      </div>
    </div>
  );
}
