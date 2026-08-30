import styles from "@/styles/loading.module.css";

export default function Loading() {
  return (
    <div className={`shell ${styles.wrap}`} role="status" aria-live="polite">
      <span className="sr-only">Загрузка…</span>
      <div className={`${styles.line} ${styles.title}`} />
      <div className={`${styles.line} ${styles.subtitle}`} />
      <div className={`${styles.line} ${styles.card}`} />
      <div className={`${styles.line} ${styles.card}`} />
      <div className={`${styles.line} ${styles.card}`} />
    </div>
  );
}
