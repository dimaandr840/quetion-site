"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * SpotlightScope — блик, следующий за курсором по сетке карточек.
 *
 * Заимствовано из taste-skill («magnetic micro-physics»): непрерывные значения
 * от указателя не хранятся в useState — иначе каждое движение мыши
 * перерисовывало бы всю сетку. Позиция кладётся напрямую в CSS-переменные
 * --mx/--my внутри requestAnimationFrame, так что React-дерево в анимации
 * вообще не участвует.
 *
 * Эффект декоративный: без мыши и при prefers-reduced-motion всё работает
 * и выглядит так же.
 */
export function SpotlightScope({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const enabled = useRef(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover)").matches;
    const calmMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    enabled.current = finePointer && !calmMotion;

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled.current) return;

      const node = ref.current;
      if (!node) return;

      const { clientX, clientY } = event;

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        // Карточки читают переменные наследованием — достаточно одной записи.
        node.style.setProperty("--mx", `${clientX - rect.left}px`);
        node.style.setProperty("--my", `${clientY - rect.top}px`);
      });
    },
    [],
  );

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={className ? `spotlight-scope ${className}` : "spotlight-scope"}
    >
      {children}
    </div>
  );
}
