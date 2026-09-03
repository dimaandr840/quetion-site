"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { QuestionSummary } from "@/lib/types";
import { LevelBadge } from "./Badge";
import { Icon } from "./Icon";
import { Tag } from "./Tag";
import styles from "./Accordion.module.css";

interface QuestionAccordionProps {
  questions: QuestionSummary[];
  defaultOpenSlug?: string;
}

export function QuestionAccordion({
  questions,
  defaultOpenSlug,
}: QuestionAccordionProps) {
  const [openSlug, setOpenSlug] = useState<string | undefined>(defaultOpenSlug);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Клавиатура. До этого аккордеон умел только Tab, то есть проход по списку
   * из 20 вопросов стоил 20 нажатий и уводил фокус в ссылки внутри открытой
   * панели. Стрелки / Home / End — стандартное поведение паттерна Accordion
   * (WAI-ARIA APG): фокус ходит только по заголовкам.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      const root = listRef.current;
      if (!root) return;

      const triggers = Array.from(
        root.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")
      );
      const current = triggers.indexOf(
        document.activeElement as HTMLButtonElement
      );
      // Фокус внутри панели (ссылка «Читать полностью») — не перехватываем.
      if (current === -1) return;

      event.preventDefault();

      let next = current;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = triggers.length - 1;
      else {
        const step = event.key === "ArrowDown" ? 1 : -1;
        next = (current + step + triggers.length) % triggers.length;
      }

      triggers[next]?.focus();
    },
    []
  );

  return (
    <div className={styles.list} ref={listRef} onKeyDown={handleKeyDown}>
      {questions.map((question) => {
        const open = openSlug === question.slug;
        const panelId = `accordion-panel-${question.slug}`;
        const triggerId = `accordion-trigger-${question.slug}`;

        return (
          <article
            key={question.slug}
            className={`${styles.item} ${open ? styles.itemOpen : ""}`}
          >
            {/* h3 вокруг кнопки: список вопросов получает нормальную иерархию
                заголовков, display: contents не меняет верстку. */}
            <h3 className={styles.heading}>
              <button
                type="button"
                id={triggerId}
                className={styles.trigger}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenSlug(open ? undefined : question.slug)}
              >
                <LevelBadge level={question.level} />
                <span className={styles.title}>{question.title}</span>
                <Icon name={open ? "chevron-up" : "chevron-down"} size={20} />
              </button>
            </h3>

            {/* Панель всегда в разметке и скрывается атрибутом hidden.
                Раньше закрытая панель не существовала в DOM: сниппет не
                находился поиском по странице (Ctrl+F), не попадал в краулер и
                не мог быть целью ссылки-якоря, а aria-controls указывал в
                пустоту — это ошибка ARIA, а не деталь реализации. */}
            <div
              className={styles.body}
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!open}
            >
              <p className={styles.snippet}>{question.snippet}</p>
              <div className={styles.meta}>
                <Link
                  href={`/questions/${question.slug}`}
                  className={styles.readMore}
                >
                  Читать полностью
                  <Icon name="arrow-right" size={16} />
                </Link>
                {question.tags[0] && <Tag>{question.tags[0]}</Tag>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
