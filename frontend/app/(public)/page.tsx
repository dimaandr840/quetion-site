import Link from "next/link";
import { HERO } from "@/lib/content";
import {
  fetchCategories,
  fetchFeaturedProfessions,
  fetchIndustries,
  fetchPopularQuestions,
  fetchProfessions,
  fetchQuestions,
} from "@/lib/content-api";
import { popularTags, questionPath, topicPills } from "@/lib/queries";
import { ButtonLink } from "@/components/ui/Button";
import { CardGrid, ProfessionCard, QuestionCard } from "@/components/ui/Cards";
import { Icon } from "@/components/ui/Icon";
import { KineticTitle } from "@/components/ui/KineticTitle";
import { Pill } from "@/components/ui/Tag";
import { SearchBar } from "@/components/ui/SearchBar";
import { SpotlightScope } from "@/components/ui/SpotlightScope";
import styles from "./page.module.css";

/**
 * На сборке (docker build) API недоступен: контейнер api ещё не запущен и сети
 * compose у сборщика нет. Поэтому страница рендерится по запросу, а не
 * пререндерится в образ. Данные при этом всё равно кешируются: в serverFetch
 * у fetch явно задан next.revalidate + тег content, так что база не получает
 * запрос на каждый хит.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, popular, allQuestions, professions, industries, categories] =
    await Promise.all([
      fetchFeaturedProfessions(8),
      fetchPopularQuestions(),
      fetchQuestions(),
      fetchProfessions(),
      fetchIndustries(),
      fetchCategories(),
    ]);

  const tags = popularTags(allQuestions);
  // Блок «Темы» с главной убран, но счётчик тем остаётся в полосе цифр.
  const topics = topicPills(categories);
  const deck = popular.slice(0, 3);

  const facts = [
    { value: professions.length, label: "профессий в каталоге" },
    { value: industries.length, label: "сфер деятельности" },
    { value: allQuestions.length, label: "разобранных вопросов" },
    { value: topics.length, label: "тем с материалами" },
  ];

  return (
    <>
      {/* HERO — асимметричный сплит вместо центрированного героя над градиентным
          мешем. Слева ровно 4 текстовых элемента, справа — превью реальных
          компонентов, а не нарисованный «скриншот» из div-ов. */}
      <div className={styles.heroWrap}>
        <section className={`shell ${styles.hero}`}>
          <div className={`stagger ${styles.heroCopy}`}>
            <p className="overline animate-in">{HERO.overline}</p>
            <h1 className={`display-large ${styles.heroTitle}`}>
              <KineticTitle text={HERO.title} accent="успешного собеседования" />
            </h1>
            <p className={`body-large animate-in ${styles.heroSubtitle}`}>
              {HERO.subtitle}
            </p>

            <div className={`animate-in ${styles.heroSearch}`}>
              <SearchBar placeholder={HERO.searchPlaceholder} showShortcut />
            </div>

            <div className={`animate-in ${styles.heroActions}`}>
              <ButtonLink
                href={HERO.primaryCta.href}
                size="large"
                className="magnetic"
              >
                {HERO.primaryCta.label}
              </ButtonLink>
              <Link href={HERO.secondaryCta.href} className={styles.heroLink}>
                {HERO.secondaryCta.label}
                <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          </div>

          {deck.length > 0 && (
            <div className={styles.deck}>
              <p className={styles.deckLabel}>Так выглядит разбор вопроса</p>
              <ul className={styles.deckStack}>
                {deck.map((question, index) => (
                  <li
                    key={question.slug}
                    className={styles.deckItem}
                    style={{ "--card-index": index } as React.CSSProperties}
                  >
                    <QuestionCard
                      question={question}
                      path={questionPath(question)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Полоса цифр: отдельное семейство лэйаута — числа с разделителями,
          без оболочки-карточки. */}
      <section className={`shell ${styles.strip}`}>
        <dl className={`reveal-children ${styles.facts}`}>
          {facts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt className={styles.factValue}>{fact.value}</dt>
              <dd className={styles.factLabel}>{fact.label}</dd>
            </div>
          ))}
        </dl>

        {tags.length > 0 && (
          <div className={`reveal ${styles.popular}`}>
            <span className={styles.popularLabel}>{HERO.popularLabel}</span>
            {tags.map((tag) => (
              <Pill
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                size="small"
              >
                {tag}
              </Pill>
            ))}
          </div>
        )}
      </section>

      <section className={`shell ${styles.section}`}>
        <div className={`reveal ${styles.sectionHead}`}>
          <div>
            <h2 className={`h2 ${styles.sectionTitle}`}>Популярные профессии</h2>
            <p className={styles.sectionSubtitle}>
              Выберите направление и начните подготовку
            </p>
          </div>
          <Link href="/professions" className={styles.sectionLink}>
            Все профессии
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        {/* Курсор подсвечивает карточку под собой — без ре-рендера React. */}
        <SpotlightScope>
          <CardGrid className="reveal-children">
            {featured.map((profession) => (
              <ProfessionCard
                key={profession.slug}
                profession={profession}
                questionCount={profession.questionCount ?? 0}
              />
            ))}
          </CardGrid>
        </SpotlightScope>
      </section>

      <section className={`shell ${styles.section}`}>
        <div className={`reveal ${styles.sectionHead}`}>
          <h2 className={`h2 ${styles.sectionTitle}`}>Популярные вопросы</h2>
          <Link href="/questions" className={styles.sectionLink}>
            Все вопросы
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className={`reveal-children ${styles.questionList}`}>
          {popular.map((question) => (
            <QuestionCard
              key={question.slug}
              question={question}
              path={questionPath(question)}
            />
          ))}
        </div>
      </section>
    </>
  );
}
