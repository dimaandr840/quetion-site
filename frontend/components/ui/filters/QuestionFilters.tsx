"use client";
import { useCallback, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Level, SortOption } from "@/lib/types";
import type { QuestionFacets } from "@/lib/facets";
import { LEVELS } from "@/lib/queries";
import { pluralizeQuestions } from "@/lib/plural";
import { buildListHref, type ListQueryState } from "@/lib/list-url";
import { useFilterDialog } from "./useFilterDialog";
import styles from "./Filters.module.css";

const DOT: Record<Level, string> = { Junior: styles.dotJunior, Middle: styles.dotMiddle, Senior: styles.dotSenior };
export interface QuestionFiltersProps {
  action: string; query?: string; levels: Level[]; selectedProfessions?: string[];
  onlyPopular?: boolean; sort: SortOption; facets: QuestionFacets; showProfessions?: boolean;
}
export function QuestionFilters({ action, query, levels, selectedProfessions = [], onlyPopular = false,
  sort, facets, showProfessions = true }: QuestionFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [needle, setNeedle] = useState("");
  const panelId = useId(), searchId = useId();
  const panelRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const modal = useFilterDialog(open, close, panelRef, triggerRef);
  const activeCount = levels.length + selectedProfessions.length + (onlyPopular ? 1 : 0);
  const state: ListQueryState = { query, levels, professions: selectedProfessions, onlyPopular, sort };
  const professions = useMemo(() => showProfessions ? facets.professions : [], [facets.professions, showProfessions]);
  const filtered = professions.filter(p => p.title.toLocaleLowerCase("ru").includes(needle.trim().toLocaleLowerCase("ru")));
  const visible = expanded || needle.trim() ? filtered : filtered.filter((p, i) => i < 6 || selectedProfessions.includes(p.slug));
  const hidden = filtered.length - visible.length;
  function commit(next: Partial<ListQueryState>) {
    if (pending) return;
    startTransition(() => router.push(buildListHref(action, { ...state, ...next }), { scroll: false }));
  }
  return (
    <div className={styles.root} data-open={open ? "true" : "false"}>
      <button ref={triggerRef} type="button" className={styles.trigger} aria-haspopup="dialog"
        data-active={activeCount > 0 ? "true" : "false"} aria-expanded={modal} aria-controls={panelId}
        onClick={() => setOpen(true)}>Фильтры {activeCount > 0 && <span className={styles.activeCount}>{activeCount}</span>}</button>
      <button type="button" className={styles.backdrop} aria-label="Закрыть фильтры" tabIndex={-1} onClick={close} />
      <form ref={panelRef} tabIndex={-1} method="get" action={action} id={panelId} className={styles.panel}
        data-pending={pending ? "true" : "false"} aria-busy={pending}
        role={modal ? "dialog" : "group"} aria-modal={modal || undefined} aria-label="Фильтры вопросов">
        {query && <input type="hidden" name="q" value={query} />}
        <span className={styles.grabber} aria-hidden="true" />
        <div className={styles.head}>
          <h2 className={styles.headTitle}>Фильтры {activeCount > 0 && <span className={styles.activeCount}>{activeCount}</span>}</h2>
          {activeCount > 0 && <button type="button" className={styles.reset} disabled={pending}
            onClick={() => commit({ levels: [], professions: [], onlyPopular: false })}>Сбросить</button>}
          <button type="button" className={styles.close} style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Закрыть фильтры" onClick={close}>✕</button>
        </div>
        <div className={styles.body}>
          <fieldset className={styles.group}>
            <legend className={styles.groupLabel}>Сложность</legend>
            {levels.length > 0 && <button type="button" className={styles.groupClear} disabled={pending}
              onClick={() => commit({ levels: [] })}>Очистить</button>}
            <div className={styles.levels}>
              {facets.levels.map(facet => {
                const checked = levels.includes(facet.value);
                return <button key={facet.value} type="button" className={styles.level} aria-pressed={checked}
                  disabled={pending || (facet.count === 0 && !checked)} onClick={() => commit({ levels: checked
                    ? levels.filter(value => value !== facet.value)
                    : LEVELS.filter(value => value === facet.value || levels.includes(value)) })}>
                  <span className={styles.levelName}><span className={`${styles.dot} ${DOT[facet.value]}`} aria-hidden="true" />{facet.value}</span>
                  <span className={styles.levelCount}>{facet.count}</span>
                  {checked && <span className={styles.check} aria-hidden="true">✓</span>}
                </button>;
              })}
            </div>
          </fieldset>
          {(facets.popular > 0 || onlyPopular) && <div className={styles.group}>
            <button type="button" className={styles.switchRow} aria-pressed={onlyPopular} disabled={pending}
              onClick={() => commit({ onlyPopular: !onlyPopular })}>
              <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb} /></span>
              Только частые на собеседованиях <span className={styles.switchMeta}>{facets.popular}</span>
            </button>
          </div>}
          {professions.length > 0 && <fieldset className={styles.group}>
            <legend className={styles.groupLabel}>Профессия</legend>
            {selectedProfessions.length > 0 && <button type="button" className={styles.groupClear} disabled={pending}
              onClick={() => commit({ professions: [] })}>Очистить</button>}
            {professions.length >= 8 && <div className={styles.search}>
              <label className="sr-only" htmlFor={searchId}>Найти профессию</label>
              <input id={searchId} type="search" className={styles.searchInput} placeholder="Найти профессию"
                value={needle} onChange={e => setNeedle(e.target.value)} />
            </div>}
            <div className={styles.list}>{visible.map(facet => {
              const checked = selectedProfessions.includes(facet.slug);
              return <button key={facet.slug} type="button" className={styles.row} aria-pressed={checked}
                disabled={pending || (facet.count === 0 && !checked)} onClick={() => commit({ professions: checked
                  ? selectedProfessions.filter(slug => slug !== facet.slug) : [...selectedProfessions, facet.slug] })}>
                <span className={styles.box} aria-hidden="true">✓</span><span className={styles.rowTitle}>{facet.title}</span>
                <span className={styles.rowCount}>{facet.count}</span>
              </button>;
            })}{visible.length === 0 && <p className={styles.noMatch}>Ничего не нашлось — проверьте опечатку.</p>}</div>
            {!needle.trim() && (hidden > 0 || expanded) && <button type="button" className={styles.more}
              onClick={() => setExpanded(value => !value)}>{expanded ? "Свернуть список" : `Показать ещё ${hidden}`}</button>}
          </fieldset>}
        </div>
        <div className={styles.footer}>
          <div className={styles.footerLine}><span role="status" aria-live="polite" aria-atomic="true">
            {pending ? "Обновляем результаты…" : `Найдено ${facets.matched} из ${facets.total}`}</span>
            {pending && <span className={styles.spinner} aria-hidden="true" />}</div>
          <button type="button" className={styles.sheetCta} onClick={close}>Показать {pluralizeQuestions(facets.matched)}</button>
        </div>
      </form>
      {/* Separate native fallback is intentionally outside the mobile panel hidden by CSS. */}
      <noscript><form action={action} method="get" aria-label="Фильтры без JavaScript">
        {query && <input type="hidden" name="q" value={query} />}
        <input type="hidden" name="sort" value={sort} />
        <fieldset><legend>Сложность</legend>{LEVELS.map(level => <label key={level}>
          <input type="checkbox" name="level" value={level} defaultChecked={levels.includes(level)} />{level}
        </label>)}</fieldset>
        {showProfessions && <fieldset><legend>Профессия</legend>{professions.map(p => <label key={p.slug}>
          <input type="checkbox" name="profession" value={p.slug} defaultChecked={selectedProfessions.includes(p.slug)} />{p.title}
        </label>)}</fieldset>}
        <label><input type="checkbox" name="only" value="popular" defaultChecked={onlyPopular} />Только частые на собеседованиях</label>
        <button type="submit">Применить фильтры</button>
      </form></noscript>
    </div>
  );
}
