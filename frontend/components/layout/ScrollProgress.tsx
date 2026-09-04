"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./ScrollProgress.module.css";

/** Поддержка возможностей браузера в течение жизни страницы не меняется. */
const subscribeNever = () => () => {};

const readCssSupport = () =>
  typeof CSS !== "undefined" &&
  CSS.supports?.("animation-timeline", "scroll()") === true;

/**
 * На сервере считаем, что CSS справится сам: разметка не зависит от значения,
 * а JS-фолбэк включается сразу после гидрации.
 */
const readCssSupportOnServer = () => true;

/**
 * Индикатор прогресса чтения под шапкой.
 *
 * На браузерах со scroll-driven анимациями полоса рисуется средствами CSS
 * (animation-timeline: scroll()) — она не трогает главный поток вообще.
 * Здесь остаётся только fallback для остальных: считаем долю прокрутки
 * в rAF, чтобы не дёргать layout на каждом событии scroll.
 *
 * Возможности браузера — внешнее состояние: читаем их через
 * useSyncExternalStore, иначе setState в теле эффекта даёт лишний
 * каскадный рендер (react-hooks/set-state-in-effect).
 */
export function ScrollProgress() {
  const supportsCss = useSyncExternalStore(
    subscribeNever,
    readCssSupport,
    readCssSupportOnServer
  );
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    if (supportsCss) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setRatio(scrollable > 0 ? Math.min(1, doc.scrollTop / scrollable) : 0);
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    // Первое измерение тоже уходит в rAF: тело эффекта состояние не трогает.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [supportsCss]);

  return (
    <div className={styles.track} aria-hidden="true">
      <div
        className={styles.bar}
        style={supportsCss ? undefined : { transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
