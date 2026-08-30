"use client";

import { useEffect, useState } from "react";
import styles from "./ScrollProgress.module.css";

/**
 * Индикатор прогресса чтения под шапкой.
 *
 * На браузерах со scroll-driven анимациями полоса рисуется средствами CSS
 * (animation-timeline: scroll()) — она не трогает главный поток вообще.
 * Здесь остаётся только fallback для остальных: считаем долю прокрутки
 * в rAF, чтобы не дёргать layout на каждом событии scroll.
 */
export function ScrollProgress() {
  const [supportsCss, setSupportsCss] = useState(true);
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const supported =
      typeof CSS !== "undefined" &&
      CSS.supports?.("animation-timeline", "scroll()") === true;

    setSupportsCss(supported);
    if (supported) return;

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

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={styles.track} aria-hidden="true">
      <div
        className={styles.bar}
        style={supportsCss ? undefined : { transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
