"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";

/** Тема живёт в атрибуте data-theme на <html> — читаем её как внешнее хранилище. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  fill: "none",
};

/** Иконки заданы инлайном, а не через public/icons: в макете нет экспорта moon,
 *  а currentColor позволяет им перекрашиваться вместе с темой. */
function SunIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      className={styles.icon}
      aria-hidden="true"
    >
      <path
        {...strokeProps}
        d="M10 1.666V3.3328M10 16.6672V18.334M4.1076 4.1076L5.2827 5.2827M14.7172 14.7172L15.8923 15.8923M1.666 10H3.3328M16.6672 10H18.334M5.2827 14.7172L4.1076 15.8923M15.8923 4.1076L14.7172 5.2827M13.3336 10C13.3336 11.8411 11.8411 13.3336 10 13.3336C8.1589 13.3336 6.6664 11.8411 6.6664 10C6.6664 8.1589 8.1589 6.6664 10 6.6664C11.8411 6.6664 13.3336 8.1589 13.3336 10Z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      className={styles.icon}
      aria-hidden="true"
    >
      <path
        {...strokeProps}
        strokeLinejoin="round"
        d="M17.5 10.6583A7.5 7.5 0 1 1 9.3417 2.5A5.8333 5.8333 0 0 0 17.5 10.6583Z"
      />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* localStorage может быть недоступен */
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className={className ? `${styles.button} ${className}` : styles.button}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
