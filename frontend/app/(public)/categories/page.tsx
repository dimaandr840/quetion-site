import type { Metadata } from "next";
import { fetchCategories, fetchProfessions, fetchSpecializations } from "@/lib/content-api";
import { pluralizeTopics } from "@/lib/plural";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CardGrid, CategoryCard } from "@/components/ui/Cards";
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

export const metadata: Metadata = buildMetadata({
  title: "Темы",
  description:
    "Все темы вопросов по профессиям и специализациям: от разработки и дизайна до маркетинга, финансов и HR.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const [categories, professions, specializations] = await Promise.all([
    fetchCategories(),
    fetchProfessions(),
    fetchSpecializations(),
  ]);

  const withCounts = categories
    .map((category) => ({ category, count: category.questionCount ?? 0 }))
    .sort(
      (a, b) =>
        b.count - a.count || a.category.title.localeCompare(b.category.title, "ru")
    );

  const ready = withCounts.filter((entry) => entry.count > 0);
  const planned = withCounts.filter((entry) => entry.count === 0);

  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Темы" }]} />

      <div className={styles.head}>
        <h1 className={`h1 ${styles.title}`}>Темы</h1>
        <p className={`body-large ${styles.intro}`}>
          Тема — самый нижний уровень каталога: сфера → профессия →
          специализация → тема. {pluralizeTopics(ready.length)} уже с разобранными
          вопросами{planned.length > 0 ? `, ещё ${planned.length} в работе` : ""}.
        </p>
      </div>

      <CardGrid>
        {ready.map(({ category, count }) => {
          const profession = professions.find(
            (item) => item.slug === category.professionSlug
          );
          const specialization = specializations.find(
            (item) =>
              item.professionSlug === category.professionSlug &&
              item.slug === category.specializationSlug
          );
          const path = [profession?.title, specialization?.title]
            .filter(Boolean)
            .join(" · ");

          return (
            <CategoryCard
              key={`${category.professionSlug}-${category.slug}`}
              category={category}
              questionCount={count}
              description={path ? `${path} · ${category.description}` : category.description}
            />
          );
        })}
      </CardGrid>

      {planned.length > 0 && (
        <section className={styles.head}>
          <h2 className="h3">Готовим материалы</h2>
          <p className={`body-base ${styles.intro}`}>
            Эти темы пока без разобранных вопросов:{" "}
            {planned.map((entry) => entry.category.title).join(", ")}.
          </p>
        </section>
      )}
    </div>
  );
}
