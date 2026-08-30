import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  emoji: string;
  title: string;
  text: string;
  large?: boolean;
  /** На странице, где заглушка — единственный контент, заголовок должен быть h1. */
  headingLevel?: "h1" | "h2";
  children?: React.ReactNode;
}

export function EmptyState({
  emoji,
  title,
  text,
  large,
  headingLevel = "h2",
  children,
}: EmptyStateProps) {
  const Heading = headingLevel;

  return (
    <div className={styles.state}>
      <span
        className={`${styles.emoji} ${large ? styles.emojiLarge : ""}`}
        aria-hidden="true"
      >
        {emoji}
      </span>
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.text}>{text}</p>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
