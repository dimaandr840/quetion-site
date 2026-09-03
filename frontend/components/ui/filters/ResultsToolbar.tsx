"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Level, SortOption } from "@/lib/types";
import { SORT_OPTIONS } from "@/lib/queries";
import { buildListHref, type ListQueryState } from "@/lib/list-url";
import styles from "./ResultsToolbar.module.css";

const LEVEL_DOT: Record<Level, string> = {
  Junior: styles.chipDotJunior,
  Middle: styles.chipDotMiddle,
  Senior: styles.chipDotSenior,
};

export interface ResultsToolbarProps {
  action: string;
  query?: string;
  levels: Level[];
  selectedProfessions?: string[];
  onlyPopular?: boolean;
  sort: SortOption;
  matched: number;
  total: number;
  /** slug → название: чипс должен показывать текст, а не slug. */
  professionTitles?: Record<string, string>;
}

/**
 * Одна полоса над выдачей отвечает сразу на три вопроса:
 * сколько нашлось, почему именно столько и как это быстро отменить.
 * Чипсы всегда рядом с результатом, а не внутри боковой панели,
 * потому что на мобильном панель закрыта.
 *
 * Крестика на чипсе нет: сам чипс — кнопка, клик по нему снимает фильтр.
 * Иконка внутри пилюли на 13px мельче зоны нажатия и читалась как мусор.
 */
export function ResultsToolbar({
  action,
  query,
  levels,
  selectedProfessions = [],
  onlyPopular = false,
  sort,
  matched,
  total,
  professionTitles = {},
}: ResultsToolbarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const state: ListQueryState = {
    query,
    levels,
    professions: selectedProfessions,
    onlyPopular,
    sort,
  };

  function commit(next: Partial<ListQueryState>) {
    startTransition(() => {
      router.push(buildListHref(action, { ...state, ...next }), {
        scroll: false,
      });
    });
  }

  const hasActive =
    levels.length > 0 || selectedProfessions.length > 0 || onlyPopular;

  return (
    <div className={styles.bar}>
      {/*
        Фильтры применяются без перезагрузки: счётчик менялся молча,
        и пользователь со скринридером не узнавал результат своего
        же действия. role="status" озвучивает новое число, не перебивая
        текущее чтение; aria-atomic — чтобы фраза читалась целиком,
        а не одним изменившимся числом без контекста.
      */}
      <p
        className={styles.count}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Найдено{" "}
        <span className={`${styles.countValue} tabular-nums`}>{matched}</span> из{" "}
        {total}
      </p>

      {hasActive && (
        <div className={styles.chips}>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              className={styles.chip}
              title={`Убрать фильтр ${level}`}
              aria-label={`Убрать фильтр ${level}`}
              onClick={() =>
                commit({ levels: levels.filter((item) => item !== level) })
              }
            >
              <span
                className={`${styles.chipDot} ${LEVEL_DOT[level]}`}
                aria-hidden="true"
              />
              {level}
            </button>
          ))}

          {selectedProfessions.map((slug) => (
            <button
              key={slug}
              type="button"
              className={styles.chip}
              title={`Убрать фильтр ${professionTitles[slug] ?? slug}`}
              aria-label={`Убрать фильтр ${professionTitles[slug] ?? slug}`}
              onClick={() =>
                commit({
                  professions: selectedProfessions.filter(
                    (item) => item !== slug
                  ),
                })
              }
            >
              {professionTitles[slug] ?? slug}
            </button>
          ))}

          {onlyPopular && (
            <button
              type="button"
              className={styles.chip}
              title="Убрать фильтр по популярности"
              aria-label="Убрать фильтр по популярности"
              onClick={() => commit({ onlyPopular: false })}
            >
              Частые на собеседованиях
            </button>
          )}

          <button
            type="button"
            className={styles.clearAll}
            onClick={() =>
              commit({ levels: [], professions: [], onlyPopular: false })
            }
          >
            Сбросить всё
          </button>
        </div>
      )}

      <span className={styles.spacer} />

      <div className={styles.sort}>
        <span className={styles.sortLabel} id="sort-label">
          Сортировка
        </span>
        <div
          className={styles.segments}
          role="group"
          aria-labelledby="sort-label"
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.segment}
              aria-pressed={sort === option.value}
              title={option.label}
              onClick={() => commit({ sort: option.value })}
            >
              {option.short}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
