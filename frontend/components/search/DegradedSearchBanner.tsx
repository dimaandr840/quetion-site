"use client";

/**
 * Баннер «поиск работает в упрощённом режиме».
 *
 * Показывается только при `degraded === true` (индекс включён, но недоступен), а не по
 * `!fromIndex`: если Meilisearch выключен конфигом, поиск по базе — штатный режим,
 * и пугать читателя нечем.
 */
export function DegradedSearchBanner({ degraded }: { degraded: boolean }) {
  if (!degraded) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <b>Поиск работает в упрощённом режиме.</b>{" "}
      Поисковый индекс временно недоступен: результаты найдены прямым поиском по базе,
      поэтому опечатки не исправляются, а порядок может отличаться от обычного.
    </div>
  );
}

export default DegradedSearchBanner;
