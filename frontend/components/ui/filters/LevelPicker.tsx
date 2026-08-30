"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Level, SortOption } from "@/lib/types";
import { LEVELS } from "@/lib/queries";
import type { LevelFacet } from "@/lib/facets";
import { buildListHref } from "@/lib/list-url";
import styles from "./Filters.module.css";

const LEVEL_DOT: Record<Level, string> = {
  Junior: styles.dotJunior,
  Middle: styles.dotMiddle,
  Senior: styles.dotSenior,
};

export interface LevelPickerProps {
  action: string;
  levels: Level[];
  sort: SortOption;
  facets: LevelFacet[];
  total: number;
}

/**
 * Компактный выбор сложности для страницы темы.
 *
 * Здесь боковая панель избыточна: фильтруется одна группа. Но визуальный
 * язык тот же, что в полном фильтре (те же плитки, те же счётчики,
 * те же цветовые маркеры) — один и тот же сценарий не должен выглядеть
 * на двух экранах как два разных продукта.
 */
export function LevelPicker({
  action,
  levels,
  sort,
  facets,
  total,
}: LevelPickerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function commit(nextLevels: Level[]) {
    startTransition(() => {
      router.push(buildListHref(action, { levels: nextLevels, sort }), {
        scroll: false,
      });
    });
  }

  return (
    <div className={styles.inlineGroup} role="group" aria-label="Сложность">
      <span className={styles.groupLabel}>Сложность</span>

      <div className={styles.inlineLevels}>
        <button
          type="button"
          className={styles.level}
          aria-pressed={levels.length === 0}
          onClick={() => commit([])}
        >
          <span className={styles.levelName}>Все уровни</span>
          <span className={styles.levelCount}>{total}</span>
        </button>

        {facets.map((facet) => {
          const checked = levels.includes(facet.value);

          return (
            <button
              key={facet.value}
              type="button"
              className={styles.level}
              aria-pressed={checked}
              disabled={facet.count === 0 && !checked}
              onClick={() =>
                commit(
                  checked
                    ? levels.filter((item) => item !== facet.value)
                    : LEVELS.filter(
                        (item) => item === facet.value || levels.includes(item)
                      )
                )
              }
            >
              <span className={styles.levelName}>
                <span
                  className={`${styles.dot} ${LEVEL_DOT[facet.value]}`}
                  aria-hidden="true"
                />
                {facet.value}
              </span>
              <span className={styles.levelCount}>{facet.count}</span>
              {checked && (
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
