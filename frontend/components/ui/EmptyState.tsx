import { Icon, type IconName } from "./Icon";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  /**
   * Иконка из набора проекта — предпочтительный вариант. Эмодзи рендерится
   * шрифтом операционной системы, поэтому один и тот же экран выглядит
   * по-разному в macOS, Windows и Android и не подчиняется токенам цвета.
   */
  icon?: IconName;
  /** Устаревшее. Оставлено, чтобы не ломать существующие вызовы. */
  emoji?: string;
  title: string;
  text: string;
  large?: boolean;
  /** На странице, где заглушка — единственный контент, заголовок должен быть h1. */
  headingLevel?: "h1" | "h2";
  children?: React.ReactNode;
}

export function EmptyState({
  icon,
  emoji,
  title,
  text,
  large,
  headingLevel = "h2",
  children,
}: EmptyStateProps) {
  const Heading = headingLevel;
  const mediaClass = `${styles.media} ${large ? styles.mediaLarge : ""}`;

  return (
    <div className={styles.state}>
      {icon ? (
        <span className={mediaClass}>
          <Icon name={icon} size={large ? 32 : 28} />
        </span>
      ) : emoji ? (
        <span className={mediaClass} aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.text}>{text}</p>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
