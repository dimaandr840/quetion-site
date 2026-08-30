import type { Metadata } from "next";
import { fetchIndustryGroups } from "@/lib/content-api";
import { pluralizeQuestions } from "@/lib/plural";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CardGrid, ProfessionCard } from "@/components/ui/Cards";
import { Pill } from "@/components/ui/Tag";
import listStyles from "@/styles/list.module.css";
import styles from "./page.module.css";
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
  title: "Профессии",
  description:
    "Каталог профессий по сферам: IT и разработка, дизайн, маркетинг, бизнес и продукт, финансы, продажи, HR, медиа и контент.",
  path: "/professions",
});

export default async function ProfessionsPage() {
  const groups = await fetchIndustryGroups();

  return (
    <div className={`shell ${listStyles.wrap}`}>
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Профессии" }]} />

      <div className={listStyles.head}>
        <h1 className={`h1 ${listStyles.title}`}>Профессии</h1>
        <p className={`body-large ${listStyles.intro}`}>
          Профессии сгруппированы по сферам. Внутри профессии материал разбит на
          специализации, темы и вопросы — можно готовиться к собеседованию или
          изучать направление системно.
        </p>
        <div className={styles.jump}>
          {groups.map(({ industry }) => (
            <Pill key={industry.slug} href={`#${industry.slug}`} size="small">
              {industry.emoji} {industry.title}
            </Pill>
          ))}
        </div>
      </div>

      <div className={styles.industries}>
        {groups.map(({ industry, professions }) => {
          const questionTotal = professions.reduce(
            (sum, profession) => sum + (profession.questionCount ?? 0),
            0
          );

          return (
            <section key={industry.slug} id={industry.slug} className={styles.industry}>
              <div className={styles.industryHead}>
                <span className={styles.industryEmoji} aria-hidden="true">
                  {industry.emoji}
                </span>
                <div>
                  <h2 className={`h3 ${styles.industryTitle}`}>{industry.title}</h2>
                  <p className={styles.industryText}>{industry.description}</p>
                  <p className={styles.industryMeta}>
                    {professions.length} проф. ·{" "}
                    {questionTotal > 0
                      ? pluralizeQuestions(questionTotal)
                      : "вопросы в работе"}
                  </p>
                </div>
              </div>

              <CardGrid>
                {professions.map((profession) => (
                  <ProfessionCard
                    key={profession.slug}
                    profession={profession}
                    questionCount={profession.questionCount ?? 0}
                  />
                ))}
              </CardGrid>
            </section>
          );
        })}
      </div>
    </div>
  );
}
