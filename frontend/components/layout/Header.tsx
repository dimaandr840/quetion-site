"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HERO, NAV_LINKS } from "@/lib/content";
import { Icon } from "../ui/Icon";
import { SearchOverlay } from "./SearchOverlay";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Header.module.css";

export interface HeaderProps {
  /**
   * Считается на сервере в layout и передаётся в поисковый оверлей.
   * Пустой дефолт нужен корневой 404: она не должна зависеть от API.
   */
  searchSuggestions?: string[];
  searchTopics?: Array<{ title: string; href: string; count: number }>;
}

export function Header({
  searchSuggestions = [],
  searchTopics = [],
}: HeaderProps = {}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  /**
   * Шапка «сжимается» и получает тень после первого же скролла:
   * так видно, что контент уезжает под полупрозрачный слой.
   * Обработчик passive и без состояния: ставит флаг только при смене значения.
   */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Ctrl/Cmd+K — глобальная точка входа в поиск с любой страницы. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Меню — оверлей навигации, поэтому закрываем его по Esc. */
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={styles.header} data-scrolled={scrolled}>
      <div className={`shell ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            D
          </span>
          <span className={styles.brandName}>DevPrep</span>
        </Link>

        <nav className={styles.nav} aria-label="Основная навигация">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Открыть поиск"
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(true)}
          >
            <Icon name="search" size={20} />
          </button>
          <span className={styles.divider} aria-hidden="true" />
          <ThemeToggle className={styles.iconButton} />
          <button
            type="button"
            className={`${styles.iconButton} ${styles.burger}`}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? "x" : "list"} size={24} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className={`shell ${styles.mobilePanel}`}
          aria-label="Мобильная навигация"
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.mobileLink} ${
                  active ? styles.mobileLinkActive : ""
                }`}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href={HERO.primaryCta.href}
            className={`${styles.cta} ${styles.mobileCta}`}
            onClick={() => setMenuOpen(false)}
          >
            {HERO.primaryCta.label}
          </Link>
        </nav>
      )}

      <SearchOverlay
        open={searchOpen}
        onClose={closeSearch}
        suggestions={searchSuggestions}
        topics={searchTopics}
      />
    </header>
  );
}
