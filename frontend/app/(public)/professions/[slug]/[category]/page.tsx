import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchCategory,
  fetchCategoryQuestions,
  fetchProfession,
  fetchSpecializations,
} from "@/lib/content-api";
import { parseLevels, parseSortOption, sortQuestions } from "@/lib/queries";
import { applyQuestionFilters, buildQuestionFacets } from "@/lib/facets";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { QuestionAccordion } from "@/components/ui/Accordion";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { LevelPicker } from "@/components/ui/filters/LevelPicker";
import { ResultsToolbar } from "@/components/ui/filters/ResultsToolbar";
import styles from "@/styles/list.module.css";
import { buildMetadata, notFoundMetadata } from "@/lib/seo";

/**
 * На сборке (docker build) API недоступен: контейнер api ещё не запущен и сети
 * compose у сборщика нет. Поэтому страница рендерится по запросу, а не
 * пререндерится в образ. Данные при этом всё равно кешируются: в serverFetch
 * у fetch явно задан next.revalidate + тег content, так что база не получает
 * запрос на каждый хит.
 */
export const dynamic = "force-dynamic";

/** Сколько вопросов показываем на одной странице категории. */
const PAGE_SIZE = 10;

interface PageProps {
  params: Promise<{ slug: string; category: string }>;
  searchParams: Promise<{
    level?: string | string[];
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, category: categorySlug } = await params;
  const category = await fetchCategory(slug, categorySlug);

  if (!category) return notFoundMetadata("Категория не найдена");

  // Пагинация и фильтры сходятся к одному canonical.
  return buildMetadata({
    title: category.title,
    description: category.description,
    path: `/professions/${slug}/${categorySlug}`,
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug, category: categorySlug } = await params;
  const [profession, category] = await Promise.all([
    fetchProfession(slug),
    fetchCategory(slug, categorySlug),
  ]);

  if (!profession || !category) notFound();

  const filters = await searchParams;
  const levels = parseLevels(filters.level);
  const sort = parseSortOption(filters.sort);

  const [allQuestions, specializations] = await Promise.all([
    fetchCategoryQuestions(slug, categorySlug),
    fetchSpecializations(slug),
  ]);
  // Те же фасеты, что в базе вопросов: счётчики считаются одним кодом.
  const facets = buildQuestionFacets(allQuestions, { levels }, []);

  const filtered = sortQuestions(
    applyQuestionFilters(allQuestions, { levels }),
    sort
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(
    Math.max(Number.parseInt(filters.page ?? "1", 10) || 1, 1),
    totalPages
  );
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const basePath = `/professions/${slug}/${categorySlug}`;
  const specialization = specializations.find(
    (item) => item.slug === category.specializationSlug
  );

  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Профессии", href: "/professions" },
          { label: profession.title, href: `/professions/${profession.slug}` },
          ...(specialization ? [{ label: specialization.title }] : []),
          { label: category.title },
        ]}
      />

      <div className={styles.head}>
        <h1 className={`h1 ${styles.title}`}>
          <span aria-hidden="true">{category.emoji}</span> {category.title}
        </h1>
        <p className={`body-large ${styles.intro}`}>{category.description}</p>
      </div>

      {/* На странице темы фильтруется только сложность, но язык тот же,
          что в базе вопросов: плитки с цветными маркерами и счётчиками. */}
      <LevelPicker
        action={basePath}
        levels={levels}
        sort={sort}
        facets={facets.levels}
        total={facets.total}
      />

      <ResultsToolbar
        action={basePath}
        levels={levels}
        sort={sort}
        matched={filtered.length}
        total={facets.total}
      />

      {visible.length > 0 ? (
        <>
          <QuestionAccordion questions={visible} defaultOpenSlug={visible[0]?.slug} />
          <Pagination
            basePath={basePath}
            currentPage={currentPage}
            totalPages={totalPages}
            extraParams={{ level: levels, sort: sort !== "popular" ? sort : undefined }}
          />
        </>
      ) : (
        <EmptyState
          emoji="📦"
          title={
            allQuestions.length > 0
              ? "По выбранному уровню вопросов нет"
              : "В этой категории пока нет вопросов"
          }
          text="Мы готовим разборы для этого раздела. Загляните позже или предложите свой вопрос."
        >
          {allQuestions.length > 0 && (
            <ButtonLink href={basePath} size="small">
              Показать все уровни
            </ButtonLink>
          )}
          <ButtonLink href="/about" variant="outline" size="small">
            Предложить вопрос
          </ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}
