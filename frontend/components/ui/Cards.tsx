import Link from "next/link";
import type { Category, Profession, QuestionSummary } from "@/lib/types";
import { pluralizeQuestions } from "@/lib/plural";
import { LevelBadge } from "./Badge";
import { Icon } from "./Icon";
import { Tag } from "./Tag";
import styles from "./Cards.module.css";

export function CardGrid({
  columns = 3,
  className,
  children,
}: {
  columns?: 2 | 3;
  /** Место для утилитарных классов анимации: reveal-children, stagger и т.п. */
  className?: string;
  children: React.ReactNode;
}) {
  const grid = columns === 2 ? styles.grid2 : styles.grid3;
  return <div className={className ? `${grid} ${className}` : grid}>{children}</div>;
}

export function ProfessionCard({
  profession,
  questionCount,
  comingSoon = questionCount === 0,
}: {
  profession: Profession;
  questionCount: number;
  comingSoon?: boolean;
}) {
  return (
    <article className={styles.card}>
      <span className={styles.emoji} aria-hidden="true">
        {profession.emoji}
      </span>
      <h3 className={styles.cardTitle}>{profession.title}</h3>
      <p className={styles.cardText}>{profession.cardDescription}</p>
      <div className={styles.cardFooter}>
        {comingSoon ? (
          <span className={styles.soon}>Вопросы в работе</span>
        ) : (
          <span className={styles.count}>{pluralizeQuestions(questionCount)}</span>
        )}
        <Link href={`/professions/${profession.slug}`} className={styles.more}>
          {comingSoon ? "Посмотреть план" : "Смотреть"}
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </article>
  );
}

export function CategoryCard({
  category,
  questionCount,
  description,
}: {
  category: Category;
  questionCount: number;
  description?: string;
}) {
  return (
    <article className={styles.card}>
      <span className={styles.emoji} aria-hidden="true">
        {category.emoji}
      </span>
      <h3 className={styles.cardTitle}>{category.title}</h3>
      <p className={styles.cardText}>{description ?? category.description}</p>
      <div className={styles.cardFooter}>
        <span className={styles.count}>{pluralizeQuestions(questionCount)}</span>
        <Link
          href={`/professions/${category.professionSlug}/${category.slug}`}
          className={styles.more}
        >
          Открыть
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </article>
  );
}

export function QuestionCard({
  question,
  path,
}: {
  question: QuestionSummary;
  path: string;
}) {
  return (
    <article className={styles.questionCard}>
      <div className={styles.questionTop}>
        <LevelBadge level={question.level} />
        <span className={styles.path}>
          {path}
          <Icon name="arrow-right" size={16} />
        </span>
      </div>
      <h3>
        <Link href={`/questions/${question.slug}`} className={styles.questionTitle}>
          {question.title}
        </Link>
      </h3>
      <p className={styles.snippet}>{question.snippet}</p>
      <div className={styles.tags}>
        {question.tags.slice(0, 2).map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
    </article>
  );
}

export function CompactQuestionCard({ question }: { question: QuestionSummary }) {
  return (
    <Link href={`/questions/${question.slug}`} className={styles.compactCard}>
      <LevelBadge level={question.level} />
      <span className={styles.compactTitle}>{question.title}</span>
    </Link>
  );
}
