"use client";

import { openCookieSettings } from "@/lib/consent";
import styles from "./CookieConsent.module.css";

interface Props {
  /** Класс места, куда вставлена кнопка: подвал или текст политики. */
  className?: string;
  label?: string;
}

/**
 * Вызывает баннер заново, чтобы согласие можно было изменить или отозвать
 * в любой момент (ч. 2 ст. 9 152-ФЗ). Именно button, а не ссылка: никуда
 * не ведёт, а меняет состояние текущей страницы.
 */
export function CookieSettingsButton({
  className,
  label = "настроить cookie",
}: Props) {
  return (
    <button
      type="button"
      className={[styles.reset, className].filter(Boolean).join(" ")}
      onClick={openCookieSettings}
    >
      {label}
    </button>
  );
}
