"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * RouteFocus — перенос фокуса в основную область после смены маршрута.
 *
 * В App Router переход не перезагружает документ: фокус остаётся на нажатой
 * ссылке (или улетает в body), а скринридер вообще не узнаёт, что страница
 * сменилась. Правило `focus-on-route-change`: после перехода фокус должен
 * оказаться в main.
 *
 * tabindex снимаем на blur, чтобы не оставлять в разметке элемент,
 * который умеет получать фокус мышью.
 *
 * Первый рендер пропускаем: при обычной загрузке страницы фокус должен
 * остаться в начале документа, иначе ломается skip-link.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const main = document.getElementById("main-content");
    if (!main) return;

    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });

    const drop = () => main.removeAttribute("tabindex");
    main.addEventListener("blur", drop, { once: true });

    return () => {
      main.removeEventListener("blur", drop);
    };
  }, [pathname]);

  return null;
}
