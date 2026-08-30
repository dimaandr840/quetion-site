import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchCategories,
  fetchIndustries,
  fetchProfession,
  fetchQuestions,
  fetchSpecializationTree,
} from "@/lib/content-api";
import {
  parseLevels,
  parseOnlyPopular,
  parseSortOption,
  sortQuestions,
} from "@/lib/queries";
import { applyQuestionFilters, buildQuestionFacets } from "@/lib/facets";
import { pluralizeQuestions } from "@/lib/plural";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CountBadge } from "@/components/ui/Badge";
import { CardGrid, CategoryCard, QuestionCard } from "@/components/ui/Cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { QuestionFilters } from "@/components/ui/filters/QuestionFilters";
import { ResultsToolbar } from "@/components/ui/filters/ResultsToolbar";
import { SearchBar } from "@/components/ui/SearchBar";
import styles from "@/styles/list.module.css";
import pageStyles from "./page.module.css";
import { buildMetadata, notFoundMetadata } from "@/lib/seo";

/**
 * На сборке (docker build) API недоступен: контейнер api ещё не запущен и сети
 * compose у сборщика нет. Поэтому страница рендерится по запросу, а не
 * пререндерится в образ. Данные при этом всё равно кешируются: в serverFetch
 * у fetch явно задан next.revalidate + тег content, так что база не получает
 * запрос на каждый хит.
 */
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    level?: string | string[];
    only?: string;
    sort?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profession = await fetchProfession(slug);

  if (!profession) return notFoundMetadata("Профессия не найдена");

  // Фильтры ?level и ?sort — всего лишь вид одной и той же страницы.
  return buildMetadata({
    title: profession.pageTitle,
    description: profession.description,
    path: `/professions/${slug}`,
  });
}

export default async function ProfessionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const profession = await fetchProfession(slug);

  if (!profession) notFound();

  const filters = await searchParams;
  const levels = parseLevels(filters.level);
  const onlyPopular = parseOnlyPopular(filters.only);
  const sort = parseSortOption(filters.sort);

  const [allQuestions, specializationTree, professionCategories, industries] =
    await Promise.all([
      fetchQuestions(),
      fetchSpecializationTree(profession.slug),
      fetchCategories(profession.slug),
      fetchIndustries(),
    ]);

  const industry = industries.find((item) => item.slug === profession.industrySlug);

  const professionQuestions = allQuestions.filter(
    (question) => question.professionSlug === profession.slug
  );
  // Одна выборка — один источник счётчиков: фильтр не может обещать больше,
  // чем окажется в выдаче.
  const selection = { levels, onlyPopular };
  const facets = buildQuestionFacets(professionQuestions, selection, []);
  const visibleQuestions = sortQuestions(
    applyQuestionFilters(professionQuestions, selection),
    sort
  );

  // Темы вне специализаций показываем отдельно, чтобы контент не терялся.
  const groupedSlugs = new Set(
    specializationTree.flatMap((group) => group.topics.map((topic) => topic.slug))
  );
  const ungroupedCategories = professionCategories
    .filter(
      (category) =>
        !groupedSlugs.has(category.slug) && (category.questionCount ?? 0) > 0
    )
    .sort((a, b) => (b.questionCount ?? 0) - (a.questionCount ?? 0));

  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Профессии", href: "/professions" },
          ...(industry
            ? [{ label: industry.title, href: `/professions#${industry.slug}` }]
            : []),
          { label: profession.title },
        ]}
      />

      <div className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={`h1 ${styles.title}`}>
            <span aria-hidden="true">{profession.emoji}</span> {profession.pageTitle}
          </h1>
          <CountBadge>{pluralizeQuestions(professionQuestions.length)}</CountBadge>
        </div>
        <p className={`body-large ${styles.intro}`}>{profession.description}</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchField}>
          <SearchBar
            placeholder="Поиск по вопросам..."
            variant="compact"
            ariaLabel={`Поиск по направлению ${profession.title}`}
          />
        </div>
      </div>

      {specializationTree.length > 0 && (
        <section>
          <h2 className={`h3 ${styles.title}`}>Специализации и темы</h2>
          <div className={pageStyles.specializations}>
            {specializationTree.map(({ specialization, topics }) => (
              <div key={specialization.slug} className={pageStyles.specialization}>
                <div className={pageStyles.specializationHead}>
                  <div>
                    <h3 className={`h4 ${pageStyles.specializationTitle}`}>
                      {specialization.title}
                    </h3>
                    <p className={pageStyles.specializationText}>
                      {specialization.description}
                    </p>
                  </div>
                  <span className={pageStyles.specializationCount}>
                    {(specialization.questionCount ?? 0) > 0
                      ? pluralizeQuestions(specialization.questionCount ?? 0)
                      : "в работе"}
                  </span>
                </div>

                <div className={pageStyles.topics}>
                  {topics.map((category) =>
                    (category.questionCount ?? 0) > 0 ? (
                      <Link
                        key={category.slug}
                        href={`/professions/${profession.slug}/${category.slug}`}
                        className={pageStyles.topicLink}
                      >
                        <span aria-hidden="true">{category.emoji}</span>
                        {category.title}
                        <span className={pageStyles.topicCount}>
                          {category.questionCount}
                        </span>
                      </Link>
                    ) : (
                      <span key={category.slug} className={pageStyles.topicSoon}>
                        <span aria-hidden="true">{category.emoji}</span>
                        {category.title}
                        <span className={pageStyles.topicCount}>скоро</span>
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {ungroupedCategories.length > 0 && (
        <section>
          <h2 className={`h3 ${styles.title}`}>Другие темы</h2>
          <CardGrid columns={2}>
            {ungroupedCategories.map((category) => (
              <CategoryCard
                key={category.slug}
                category={category}
                questionCount={category.questionCount ?? 0}
              />
            ))}
          </CardGrid>
        </section>
      )}

      <div className={styles.layout}>
        <QuestionFilters
          action={`/professions/${profession.slug}`}
          levels={levels}
          onlyPopular={onlyPopular}
          sort={sort}
          facets={facets}
          showProfessions={false}
        />

        <div className={styles.content}>
          <ResultsToolbar
            action={`/professions/${profession.slug}`}
            levels={levels}
            onlyPopular={onlyPopular}
            sort={sort}
            matched={visibleQuestions.length}
            total={facets.total}
          />

          {visibleQuestions.length > 0 ? (
            visibleQuestions.map((question) => (
              <QuestionCard
                key={question.slug}
                question={question}
                path={question.path ?? ""}
              />
            ))
          ) : (
            <EmptyState
              emoji="📦"
              title="По выбранным фильтрам ничего нет"
              text="Попробуйте снять фильтр по сложности или предложите свой вопрос — мы разберём его."
            >
              <ButtonLink href={`/professions/${profession.slug}`} size="small">
                Сбросить фильтры
              </ButtonLink>
              <ButtonLink href="/about" variant="outline" size="small">
                Предложить вопрос
              </ButtonLink>
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
