"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  setProgress,
  subscribeProgress,
  type QuestionProgress,
} from "@/lib/progress";
import { Icon } from "./Icon";
import styles from "./QuestionActions.module.css";

const FEEDBACK_EMAIL = "hello@devprep.local";

interface QuestionActionsProps {
  slug: string;
  title: string;
}

type ShareState = "idle" | "copied" | "failed";

export function QuestionActions({ slug, title }: QuestionActionsProps) {
  const getSnapshot = useCallback(() => getProgressSnapshot(slug), [slug]);
  const progress = useSyncExternalStore(
    subscribeProgress,
    getSnapshot,
    getProgressServerSnapshot
  );

  const [shareState, setShareState] = useState<ShareState>("idle");
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (shareTimer.current) clearTimeout(shareTimer.current);
  }, []);

  /** Повторное нажатие снимает отметку — иначе её нельзя было бы отменить. */
  const toggle = (value: QuestionProgress) =>
    setProgress(slug, progress === value ? null : value);

  function flashShareState(state: ShareState) {
    setShareState(state);
    if (shareTimer.current) clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareState("idle"), 2500);
  }

  async function onShare() {
    const url = window.location.href;

    // navigator.share есть в основном на мобильных; на десктопе копируем ссылку.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Пользователь закрыл системное меню — молча уходим в буфер обмена.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flashShareState("copied");
    } catch {
      flashShareState("failed");
    }
  }

  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    `DevPrep: ошибка в вопросе «${title}»`
  )}&body=${encodeURIComponent(
    `Вопрос: ${title}\nСсылка: /questions/${slug}\n\nЧто не так:\n`
  )}`;

  const shareLabel =
    shareState === "copied"
      ? "Ссылка скопирована"
      : shareState === "failed"
        ? "Не удалось скопировать"
        : "Поделиться";

  return (
    <div className={styles.bar}>
      <div className={styles.group} role="group" aria-label="Отметить прогресс">
        <span className={styles.groupLabel}>Как вам вопрос?</span>
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.button} ${progress === "known" ? styles.known : ""}`}
            aria-pressed={progress === "known"}
            onClick={() => toggle("known")}
          >
            <Icon name="check-circle" size={16} />
            Знаю
          </button>
          <button
            type="button"
            className={`${styles.button} ${progress === "repeat" ? styles.repeat : ""}`}
            aria-pressed={progress === "repeat"}
            onClick={() => toggle("repeat")}
          >
            <Icon name="highlighter" size={16} />
            Повторить
          </button>
        </div>
      </div>

      <div className={styles.secondary}>
        <button type="button" className={styles.button} onClick={onShare}>
          <Icon name={shareState === "copied" ? "check" : "share-2"} size={16} />
          {shareLabel}
        </button>
        <a className={styles.button} href={mailto}>
          <Icon name="alert-triangle" size={16} />
          Сообщить об ошибке
        </a>
      </div>

      <p className={styles.hint} aria-live="polite">
        {progress === "known"
          ? "Отмечено: знаю. Отметка сохранена в этом браузере."
          : progress === "repeat"
            ? "Отмечено: повторить. Отметка сохранена в этом браузере."
            : "Отметки хранятся только в вашем браузере, аккаунт не нужен."}
      </p>
    </div>
  );
}
