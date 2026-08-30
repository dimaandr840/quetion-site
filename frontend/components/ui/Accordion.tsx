"use client";

import { useState } from "react";
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

  return (
    <div className={styles.list}>
      {questions.map((question) => {
        const open = openSlug === question.slug;
        const panelId = `accordion-panel-${question.slug}`;

        return (
          <article
            key={question.slug}
            className={`${styles.item} ${open ? styles.itemOpen : ""}`}
          >
            {/* h3 вокруг кнопки: список вопросов получает нормальную иерархию заголовков,
                display: contents не меняет верстку. */}
            <h3 style={{ display: "contents", margin: 0, font: "inherit" }}>
              <button
                type="button"
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

            {open && (
              <div className={styles.body} id={panelId}>
                <p className={styles.snippet}>{question.snippet}</p>
                <div className={styles.meta}>
                  <Link href={`/questions/${question.slug}`} className={styles.readMore}>
                    Читать полностью
                    <Icon name="arrow-right" size={16} />
                  </Link>
                  {question.tags[0] && <Tag>{question.tags[0]}</Tag>}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
