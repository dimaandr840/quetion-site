"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  placeholder: string;
  defaultValue?: string;
  variant?: "hero" | "compact";
  showShortcut?: boolean;
  ariaLabel?: string;
}

export function SearchBar({
  placeholder,
  defaultValue = "",
  variant = "hero",
  showShortcut = false,
  ariaLabel = "Поиск по вопросам",
}: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={`${styles.form} ${variant === "compact" ? styles.compact : ""}`}
    >
      <Icon name="search" size={variant === "compact" ? 18 : 24} />
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={styles.input}
      />
      {showShortcut && (
        <kbd className={styles.shortcut} aria-hidden="true">
          Ctrl + K
        </kbd>
      )}
      <button type="submit" className={styles.submit} aria-label="Найти">
        <Icon name="arrow-right" size={variant === "compact" ? 16 : 20} />
      </button>
    </form>
  );
}
