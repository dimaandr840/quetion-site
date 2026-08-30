import Link from "next/link";
import type { Level, Profession, SortOption } from "@/lib/types";
import { LEVELS, SORT_OPTIONS } from "@/lib/queries";
import styles from "@/styles/list.module.css";

interface QuestionFiltersProps {
  /** Куда отправляется форма — текущий путь страницы. */
  action: string;
  /** Поисковый запрос, который нужно сохранить между применениями фильтра. */
  query?: string;
  levels: Level[];
  sort: SortOption;
  professionOptions?: Profession[];
  selectedProfessions?: string[];
}

/**
 * Фильтры работают через обычную GET-форму: состояние живёт в URL,
 * страница остаётся серверной и результат можно скопировать ссылкой.
 */
export function QuestionFilters({
  action,
  query,
  levels,
  sort,
  professionOptions,
  selectedProfessions = [],
}: QuestionFiltersProps) {
  const hasActiveFilters =
    levels.length > 0 || selectedProfessions.length > 0 || sort !== "popular";

  return (
    <form method="get" action={action} className={styles.sidebar}>
      {query ? <input type="hidden" name="q" value={query} /> : null}

      <h2 className={styles.filterTitle}>Фильтры</h2>

      <fieldset className={styles.filterGroup}>
        <legend className={styles.filterLabel}>Сложность</legend>
        {LEVELS.map((level) => (
          <label key={level} className={styles.filterOption}>
            <input
              type="checkbox"
              name="level"
              value={level}
              defaultChecked={levels.includes(level)}
            />
            {level}
          </label>
        ))}
      </fieldset>

      {professionOptions && professionOptions.length > 0 && (
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLabel}>Профессия</legend>
          {professionOptions.map((profession) => (
            <label key={profession.slug} className={styles.filterOption}>
              <input
                type="checkbox"
                name="profession"
                value={profession.slug}
                defaultChecked={selectedProfessions.includes(profession.slug)}
              />
              {profession.title}
            </label>
          ))}
        </fieldset>
      )}

      <div className={styles.filterGroup}>
        <label className={styles.filterLabel} htmlFor="filter-sort">
          Сортировка
        </label>
        <select
          id="filter-sort"
          name="sort"
          defaultValue={sort}
          className={styles.select}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterActions}>
        <button type="submit" className={styles.applyButton}>
          Применить
        </button>
        {hasActiveFilters && (
          <Link
            href={query ? `${action}?q=${encodeURIComponent(query)}` : action}
            className={styles.resetLink}
          >
            Сбросить
          </Link>
        )}
      </div>
    </form>
  );
}
