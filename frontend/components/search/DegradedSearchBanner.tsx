import styles from "./DegradedSearchBanner.module.css";

/**
 * Баннер «поиск работает в упрощённом режиме».
 *
 * Показывается только при `degraded === true` (индекс включён, но недоступен), а не по
 * `!fromIndex`: если Meilisearch выключен конфигом, поиск по базе — штатный режим,
 * и пугать читателя нечем.
 *
 * Компонент серверный: состояние приходит вместе с выдачей, отдельный запрос
 * статуса из браузера не нужен.
 */
export function DegradedSearchBanner({ degraded }: { degraded: boolean }) {
  if (!degraded) return null;

  return (
    <div role="status" aria-live="polite" className={styles.banner}>
      <span className={styles.title}>Поиск работает в упрощённом режиме.</span>{" "}
      Поисковый индекс временно недоступен: результаты найдены прямым поиском по базе,
      поэтому опечатки не исправляются, а порядок может отличаться от обычного.
    </div>
  );
}

export default DegradedSearchBanner;
