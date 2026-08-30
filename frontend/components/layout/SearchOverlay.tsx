"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getRecentSearches, rememberSearch } from "@/lib/recent";
import type { QuestionSummary } from "@/lib/types";
import { Icon } from "../ui/Icon";
import styles from "./SearchOverlay.module.css";

const RESULT_LIMIT = 6;
const DEBOUNCE_MS = 250;

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Считаются на сервере в layout: подсказки и темы одинаковы для всех. */
  suggestions: string[];
  topics: Array<{ title: string; href: string; count: number }>;
}

interface SearchResponse {
  items: QuestionSummary[];
}

export function SearchOverlay({
  open,
  onClose,
  suggestions,
  topics,
}: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuestionSummary[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /** localStorage читаем только когда оверлей уже открыт — значит, уже в браузере. */
  const recent = useMemo(() => (open ? getRecentSearches() : []), [open]);

  /**
   * Поиск идёт через /api/search — тот же индекс, что и на странице результатов.
   * Debounce, чтобы не бить по API на каждый символ; ответы устаревших запросов
   * отбрасываются по флагу, иначе они могли бы перезаписать свежие.
   */
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => {
          if (!cancelled) setResults(response.items.slice(0, RESULT_LIMIT));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  /** Открытие: фокус на поле и блокировка прокрутки фона. */
  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      // Фокус не должен уходить из диалога, пока он открыт.
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    setQuery("");
    setResults([]);
    router.push(href);
  }

  /** Запрос запоминаем только при явном переходе, а не на каждом символе. */
  function goToSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed) rememberSearch(trimmed);
    go(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) =>
        results.length === 0 ? 0 : (index - 1 + results.length) % results.length
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const picked = results[highlight];
      if (picked) {
        rememberSearch(query);
        go(`/questions/${picked.slug}`);
      } else {
        goToSearch(query);
      }
    }
  }

  function onQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setQuery(value);
    setHighlight(0);
    if (!value.trim()) setResults([]);
  }

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по вопросам"
        className={styles.dialog}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.field}>
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={onQueryChange}
            onKeyDown={onInputKeyDown}
            placeholder="Найти вопрос, тему или тег"
            aria-label="Поисковый запрос"
            className={styles.input}
            autoComplete="off"
          />
          <kbd className={styles.shortcut} aria-hidden="true">
            Esc
          </kbd>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Закрыть поиск"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className={styles.body}>
          {query.trim() === "" ? (
            <>
              {recent.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Недавние запросы</h2>
                  <div className={styles.chips}>
                    {recent.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={styles.chip}
                        onClick={() => goToSearch(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {suggestions.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Популярные теги</h2>
                  <div className={styles.chips}>
                    {suggestions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={styles.chip}
                        onClick={() => goToSearch(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {topics.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Темы с материалами</h2>
                  <ul className={styles.list}>
                    {topics.map((topic) => (
                      <li key={topic.href}>
                        <Link href={topic.href} className={styles.row} onClick={onClose}>
                          <span className={styles.rowTitle}>{topic.title}</span>
                          <span className={styles.rowMeta}>{topic.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : results.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Вопросы</h2>
              <ul className={styles.list}>
                {results.map((question, index) => (
                  <li key={question.slug}>
                    <Link
                      href={`/questions/${question.slug}`}
                      className={`${styles.row} ${
                        index === highlight ? styles.rowActive : ""
                      }`}
                      onClick={onClose}
                      onMouseEnter={() => setHighlight(index)}
                    >
                      <span className={styles.rowTitle}>{question.title}</span>
                      <span className={styles.rowMeta}>{question.level}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.allResults}
                onClick={() => goToSearch(query)}
              >
                Показать все результаты
                <Icon name="arrow-right" size={16} />
              </button>
            </section>
          ) : (
            <section className={styles.section}>
              <p className={styles.empty}>
                Ничего не нашлось. Попробуйте один из тегов ниже.
              </p>
              <div className={styles.chips}>
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.chip}
                    onClick={() => goToSearch(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
