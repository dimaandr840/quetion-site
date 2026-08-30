import type { Metadata } from "next";
import { FOOTER_TAGLINE } from "@/lib/content";
import {
  fetchCategories,
  fetchIndustries,
  fetchProfessions,
  fetchQuestions,
  fetchSpecializations,
} from "@/lib/content-api";
import { pluralizeQuestions, pluralizeTopics } from "@/lib/plural";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
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
  title: "О проекте",
  description: FOOTER_TAGLINE,
  path: "/about",
});

export default async function AboutPage() {
  const [professions, categories, industries, questions, specializations] =
    await Promise.all([
      fetchProfessions(),
      fetchCategories(),
      fetchIndustries(),
      fetchQuestions(),
      fetchSpecializations(),
    ]);

  const total = questions.length;
  const coveredProfessions = new Set(questions.map((q) => q.professionSlug));
  const coveredCategories = categories.filter(
    (category) => (category.questionCount ?? 0) > 0
  );
  const industryByProfession = new Map(
    professions.map((profession) => [profession.slug, profession.industrySlug])
  );
  const coveredIndustries = new Set(
    [...coveredProfessions]
      .map((slug) => industryByProfession.get(slug))
      .filter(Boolean)
  );

  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "О проекте" }]} />

      <div className={styles.head}>
        <h1 className={`h1 ${styles.title}`}>О проекте</h1>
        <p className={`body-large ${styles.intro}`}>{FOOTER_TAGLINE}</p>
      </div>

      <section className={styles.head}>
        <h2 className="h3">Как устроена база</h2>
        <p className={`body-base ${styles.intro}`}>
          Всё содержимое разложено на четыре уровня: сфера → профессия →
          специализация → тема. Вопросы живут внутри тем, поэтому одна и та же
          структура работает и для разработки, и для маркетинга, финансов или HR.
        </p>
      </section>

      <section className={styles.head}>
        <h2 className="h3">Что уже есть</h2>
        <p className={`body-base ${styles.intro}`}>
          В базе {pluralizeQuestions(total)} — каждый вопрос разобран подробно:
          короткий TL;DR для повторения, развёрнутый ответ, примеры и ссылки на
          похожие вопросы. Материалы охватывают{" "}
          {pluralizeTopics(coveredCategories.length)} в {coveredProfessions.size} из{" "}
          {professions.length} профессий и {coveredIndustries.size} из{" "}
          {industries.length} сфер; остальное мы наполняем постепенно — на таких
          страницах честно написано «в работе». Всего в каталоге{" "}
          {specializations.length} специализаций.
        </p>
      </section>

      <section className={styles.head}>
        <h2 className="h3">Как мы готовим ответы</h2>
        <p className={`body-base ${styles.intro}`}>
          Мы берём вопросы, которые реально звучат на собеседованиях, и пишем
          ответы так, чтобы их можно было проговорить вслух за одну-две минуты.
          Сначала суть, затем детали и подводные камни, которые обычно уточняет
          интервьюер. К части вопросов идёт практическое задание с подсказкой —
          его лучше решить до того, как подглядывать ответ.
        </p>
      </section>

      <section className={styles.head}>
        <h2 className="h3">Чего здесь нет</h2>
        <p className={`body-base ${styles.intro}`}>
          Мы не публикуем «утечки» задач конкретных компаний и не обещаем
          тысячи вопросов ради цифры на главной. Лучше меньше материалов, но
          таких, на которые можно опереться на реальном интервью.
        </p>
      </section>

      <section className={styles.head}>
        <h2 className="h3">Предложить вопрос или сообщить об ошибке</h2>
        <p className={`body-base ${styles.intro}`}>
          Если вам задали вопрос, которого здесь нет, или вы нашли неточность в
          ответе — напишите нам. Мы дополним разбор и укажем автора правки.
        </p>
        <div className={styles.filterActions}>
          <ButtonLink href="mailto:hello@devprep.local?subject=DevPrep%3A%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B8%D1%82%D1%8C%20%D0%B2%D0%BE%D0%BF%D1%80%D0%BE%D1%81">
            Написать нам
          </ButtonLink>
          <ButtonLink href="/questions" variant="outline">
            Смотреть базу вопросов
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
