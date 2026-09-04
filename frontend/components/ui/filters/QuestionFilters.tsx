"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Level, SortOption } from "@/lib/types";
import type { QuestionFacets } from "@/lib/facets";
import { LEVELS } from "@/lib/queries";
import { pluralizeQuestions } from "@/lib/plural";
import { buildListHref, type ListQueryState } from "@/lib/list-url";
import styles from "./Filters.module.css";

/** Сколько профессий показываем до «Показать все». */
const COLLAPSED_PROFESSIONS = 6;
/** С какого размера списка появляется поиск внутри группы. */
const SEARCHABLE_FROM = 8;

/** Пустой список со стабильной ссылкой: иначе зависимости useMemo меняются каждый рендер. */
const NO_PROFESSIONS: QuestionFacets["professions"] = [];

const LEVEL_DOT: Record<Level, string> = {
  Junior: styles.dotJunior,
  Middle: styles.dotMiddle,
  Senior: styles.dotSenior,
};

export interface QuestionFiltersProps {
  /** Путь текущей страницы — состояние фильтра живёт в его URL. */
  action: string;
  query?: string;
  levels: Level[];
  selectedProfessions?: string[];
  onlyPopular?: boolean;
  sort: SortOption;
  facets: QuestionFacets;
  /** На странице одной профессии группа «Профессия» не имеет смысла. */
  showProfessions?: boolean;
}

/**
 * Фильтр базы вопросов.
 *
 * Решения, которые отличают его от обычной GET-формы:
 *
 * 1. Мгновенное применение. Клик по значению сразу меняет URL и выдачу;
 *    кнопка «Применить» остаётся только в <noscript>.
 * 2. Фасетные счётчики у каждого значения: видно, что будет до клика.
 * 3. Значения без результатов выключены — тупика «0 вопросов» больше нет.
 * 4. Сортировка уехала в тулбар результатов: это порядок, а не фильтр.
 * 5. На узком экране панель — шит по кнопке, а не стена перед выдачей.
 */
export function QuestionFilters({
  action,
  query,
  levels,
  selectedProfessions = [],
  onlyPopular = false,
  sort,
  facets,
  showProfessions = true,
}: QuestionFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [needle, setNeedle] = useState("");
  const searchId = useId();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const professionFacets = useMemo(
    () => (showProfessions ? facets.professions : NO_PROFESSIONS),
    [showProfessions, facets.professions]
  );
  const hasProfessionSearch = professionFacets.length >= SEARCHABLE_FROM;

  const activeCount =
    levels.length + selectedProfessions.length + (onlyPopular ? 1 : 0);

  const state: ListQueryState = useMemo(
    () => ({
      query,
      levels,
      professions: selectedProfessions,
      onlyPopular,
      sort,
    }),
    [query, levels, selectedProfessions, onlyPopular, sort]
  );

  /** Любое изменение фильтра сбрасывает страницу: page в состояние не попадает. */
  function commit(next: Partial<ListQueryState>) {
    const href = buildListHref(action, { ...state, ...next });
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  function toggleLevel(level: Level) {
    commit({
      levels: levels.includes(level)
        ? levels.filter((item) => item !== level)
        : // Порядок в URL детерминирован: один набор — одна ссылка.
          LEVELS.filter((item) => item === level || levels.includes(item)),
    });
  }

  function toggleProfession(slug: string) {
    commit({
      professions: selectedProfessions.includes(slug)
        ? selectedProfessions.filter((item) => item !== slug)
        : [...selectedProfessions, slug],
    });
  }

  function resetAll() {
    commit({ levels: [], professions: [], onlyPopular: false });
  }

  // Escape закрывает шит, фокус возвращается на триггер.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const filteredProfessions = useMemo(() => {
    const term = needle.trim().toLowerCase();
    if (!term) return professionFacets;
    return professionFacets.filter((item) =>
      item.title.toLowerCase().includes(term)
    );
  }, [needle, professionFacets]);

  // Выбранное никогда не прячется под «Показать все».
  const visibleProfessions =
    expanded || needle.trim()
      ? filteredProfessions
      : filteredProfessions.filter(
          (item, index) =>
            index < COLLAPSED_PROFESSIONS ||
            selectedProfessions.includes(item.slug)
        );

  const hiddenCount = filteredProfessions.length - visibleProfessions.length;

  return (
    <div className={styles.root} data-open={open ? "true" : "false"}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        data-active={activeCount > 0 ? "true" : "false"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M2 4h12M4.5 8h7M6.5 12h3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        Фильтры
        {activeCount > 0 && (
          <span className={styles.activeCount}>{activeCount}</span>
        )}
      </button>

      <button
        type="button"
        className={styles.backdrop}
        aria-label="Закрыть фильтры"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      {/* При выключенном JS это обычная GET-форма с кнопкой в <noscript>. */}
      <form
        method="get"
        action={action}
        id={panelId}
        className={styles.panel}
        data-pending={isPending ? "true" : "false"}
        aria-busy={isPending}
        role="group"
        aria-label="Фильтры вопросов"
      >
        {query ? <input type="hidden" name="q" value={query} /> : null}
        {sort !== "popular" ? (
          <input type="hidden" name="sort" value={sort} />
        ) : null}

        <span className={styles.grabber} aria-hidden="true" />

        <div className={styles.head}>
          <h2 className={styles.headTitle}>
            Фильтры
            {activeCount > 0 && (
              <span className={styles.activeCount}>{activeCount}</span>
            )}
          </h2>

          {activeCount > 0 && (
            <button type="button" className={styles.reset} onClick={resetAll}>
              Сбросить
            </button>
          )}

          <button
            type="button"
            className={styles.close}
            aria-label="Закрыть фильтры"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <fieldset className={styles.group}>
            <div className={styles.groupHead}>
              <legend className={styles.groupLabel}>Сложность</legend>
              {levels.length > 0 && (
                <button
                  type="button"
                  className={styles.groupClear}
                  onClick={() => commit({ levels: [] })}
                >
                  Очистить
                </button>
              )}
            </div>

            <div className={styles.levels}>
              {facets.levels.map((facet) => {
                const checked = levels.includes(facet.value);
                const empty = facet.count === 0 && !checked;

                return (
                  <button
                    key={facet.value}
                    type="button"
                    className={styles.level}
                    aria-pressed={checked}
                    disabled={empty}
                    onClick={() => toggleLevel(facet.value)}
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

            {/* Значения для формы без JS. */}
            {levels.map((level) => (
              <input key={level} type="hidden" name="level" value={level} />
            ))}
          </fieldset>

          {facets.popular > 0 && (
            <div className={styles.group}>
              <button
                type="button"
                className={styles.switchRow}
                aria-pressed={onlyPopular}
                onClick={() => commit({ onlyPopular: !onlyPopular })}
              >
                <span className={styles.switchTrack} aria-hidden="true">
                  <span className={styles.switchThumb} />
                </span>
                Только частые на собеседованиях
                <span className={styles.switchMeta}>{facets.popular}</span>
              </button>
              {onlyPopular && (
                <input type="hidden" name="only" value="popular" />
              )}
            </div>
          )}

          {professionFacets.length > 0 && (
            <fieldset className={styles.group}>
              <div className={styles.groupHead}>
                <legend className={styles.groupLabel}>Профессия</legend>
                {selectedProfessions.length > 0 && (
                  <button
                    type="button"
                    className={styles.groupClear}
                    onClick={() => commit({ professions: [] })}
                  >
                    Очистить
                  </button>
                )}
              </div>

              {hasProfessionSearch && (
                <div className={styles.search}>
                  <label className="sr-only" htmlFor={searchId}>
                    Найти профессию
                  </label>
                  <input
                    id={searchId}
                    type="text"
                    className={styles.searchInput}
                    placeholder="Найти профессию"
                    value={needle}
                    autoComplete="off"
                    onChange={(event) => setNeedle(event.target.value)}
                  />
                  {needle && (
                    <button
                      type="button"
                      className={styles.searchClear}
                      aria-label="Очистить поиск"
                      onClick={() => setNeedle("")}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              <div className={styles.list}>
                {visibleProfessions.map((facet) => {
                  const checked = selectedProfessions.includes(facet.slug);

                  return (
                    <button
                      key={facet.slug}
                      type="button"
                      className={styles.row}
                      aria-pressed={checked}
                      disabled={facet.count === 0 && !checked}
                      onClick={() => toggleProfession(facet.slug)}
                    >
                      <span className={styles.box} aria-hidden="true">
                        ✓
                      </span>
                      <span className={styles.rowTitle}>{facet.title}</span>
                      <span className={styles.rowCount}>{facet.count}</span>
                    </button>
                  );
                })}

                {visibleProfessions.length === 0 && (
                  <p className={styles.noMatch}>
                    Ничего не нашлось — проверьте опечатку.
                  </p>
                )}
              </div>

              {!needle.trim() && (hiddenCount > 0 || expanded) && (
                <button
                  type="button"
                  className={styles.more}
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded
                    ? "Свернуть список"
                    : `Показать ещё ${hiddenCount}`}
                </button>
              )}

              {selectedProfessions.map((slug) => (
                <input
                  key={slug}
                  type="hidden"
                  name="profession"
                  value={slug}
                />
              ))}
            </fieldset>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLine}>
            <span aria-live="polite">
              Найдено{" "}
              <span className={styles.footerValue}>{facets.matched}</span>
              {" "}из {facets.total}
            </span>
            {isPending && <span className={styles.spinner} aria-hidden="true" />}
          </div>

          <button
            type="button"
            className={styles.sheetCta}
            onClick={() => setOpen(false)}
          >
            Показать {pluralizeQuestions(facets.matched)}
          </button>
        </div>

        <noscript>
          <button type="submit" className={styles.noscriptApply}>
            Применить фильтры
          </button>
        </noscript>
      </form>
    </div>
  );
}
