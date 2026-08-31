import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchCategory,
  fetchProfession,
  fetchQuestion,
  fetchQuestions,
} from "@/lib/content-api";
import { stripInlineHtml } from "@/lib/inline-html";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LevelBadge } from "@/components/ui/Badge";
import { CardGrid, CompactQuestionCard } from "@/components/ui/Cards";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { QuestionActions } from "@/components/ui/QuestionActions";
import { RichText } from "@/components/ui/RichText";
import styles from "./question.module.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { questionSchema } from "@/lib/schema";
import { buildMetadata, notFoundMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const question = await fetchQuestion(slug);

  if (!question) return notFoundMetadata("Вопрос не найден");

  return buildMetadata({
    title: question.title,
    // В описании не должно быть разметки: в базе она может остаться от редактора.
    description: stripInlineHtml(question.tldr),
    path: `/questions/${slug}`,
    type: "article",
  });
}

/**
 * Пререндер страниц вопросов на сборке: быстрый TTFB для краулера.
 * Если API на момент сборки недоступен — страницы отрендерятся по запросу.
 */
export async function generateStaticParams() {
  try {
    const questions = await fetchQuestions();
    return questions.map((question) => ({ slug: question.slug }));
  } catch {
    return [];
  }
}

export default async function QuestionPage({ params }: PageProps) {
  const { slug } = await params;
  const question = await fetchQuestion(slug);

  if (!question) notFound();

  const [profession, category] = await Promise.all([
    fetchProfession(question.professionSlug),
    fetchCategory(question.professionSlug, question.categorySlug),
  ]);

  const previous = question.previous;
  const next = question.next;
  const related = question.related ?? [];
  const tasks = question.tasks ?? [];

  return (
    <div className={`shell ${styles.wrap}`}>
      <JsonLd
        data={questionSchema(question, {
          path: `/questions/${slug}`,
          sectionName: category?.title,
        })}
      />
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Профессии", href: "/professions" },
          ...(profession
            ? [{ label: profession.title, href: `/professions/${profession.slug}` }]
            : []),
          ...(category && profession
            ? [
                {
                  label: category.title,
                  href: `/professions/${profession.slug}/${category.slug}`,
                },
              ]
            : []),
          { label: question.title },
        ]}
      />

      <div className={styles.head}>
        <div className={styles.metaRow}>
          <LevelBadge level={question.level} />
          {category && profession && (
            <span className={styles.topic}>
              Тема:{" "}
              <Link
                href={`/professions/${profession.slug}/${category.slug}`}
                className={styles.topicLink}
              >
                {category.title}
              </Link>
            </span>
          )}
        </div>
        <h1 className={`h1 ${styles.title}`}>{question.title}</h1>
      </div>

      <div className={styles.layout}>
        <article className={styles.article}>
          {/* Блок «TL;DR» убран: аббревиатура непонятна, а сам текст дублировал
              первый абзац ответа. Краткая суть остаётся в описании страницы. */}
          <QuestionActions slug={question.slug} title={question.title} />

          {question.sections.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2 className={`h3 ${styles.sectionHeading}`}>{section.heading}</h2>

              {section.paragraphs?.map((paragraph, index) => (
                <RichText
                  key={index}
                  as="p"
                  className={styles.paragraph}
                  html={paragraph}
                />
              ))}

              {section.bullets && (
                <ul className={styles.bullets}>
                  {section.bullets.map((bullet, index) => (
                    <RichText key={index} as="li" html={bullet} />
                  ))}
                </ul>
              )}

              {section.code && <CodeBlock sample={section.code} />}
            </section>
          ))}

          {tasks.length > 0 && (
            <section id="practice" className={styles.section}>
              <h2 className={`h3 ${styles.sectionHeading}`}>Практические задания</h2>
              <p className={styles.paragraph}>
                Проверьте себя: сформулируйте ответ вслух или выполните задание до
                того, как откроете подсказку.
              </p>
              <ol className={styles.taskList}>
                {tasks.map((task) => (
                  <li key={task.id} className={styles.task}>
                    <h3 className={styles.taskTitle}>{task.title}</h3>
                    {task.statement.map((line, index) => (
                      <p key={index} className={styles.paragraph}>
                        {line}
                      </p>
                    ))}
                    {task.hint && (
                      <details className={styles.hint}>
                        <summary className={styles.hintSummary}>Показать подсказку</summary>
                        <p className={styles.hintText}>{task.hint}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(previous || next) && (
            <nav className={styles.siblings} aria-label="Навигация по вопросам">
              {previous && (
                <Link href={`/questions/${previous.slug}`} className={styles.sibling}>
                  <span className={styles.siblingLabel}>Предыдущий вопрос</span>
                  <span className={styles.siblingTitle}>{previous.title}</span>
                </Link>
              )}
              {next && (
                <Link
                  href={`/questions/${next.slug}`}
                  className={`${styles.sibling} ${styles.siblingNext}`}
                >
                  <span className={styles.siblingLabel}>Следующий вопрос</span>
                  <span className={styles.siblingTitle}>{next.title}</span>
                </Link>
              )}
            </nav>
          )}
        </article>

        <aside className={styles.toc} aria-label="Содержание страницы">
          <h2 className={styles.tocTitle}>На этой странице</h2>
          <nav className={styles.tocList}>
            {question.sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className={styles.tocLink}>
                {section.heading}
              </a>
            ))}
            {tasks.length > 0 && (
              <a href="#practice" className={styles.tocLink}>
                Практические задания
              </a>
            )}
          </nav>
        </aside>
      </div>

      {related.length > 0 && (
        <section className={styles.related}>
          <h2 className={`h3 ${styles.relatedTitle}`}>Похожие вопросы</h2>
          <CardGrid>
            {related.map((item) => (
              <CompactQuestionCard key={item.slug} question={item} />
            ))}
          </CardGrid>
        </section>
      )}
    </div>
  );
}
