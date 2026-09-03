import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

/**
 * Системный скелетон.
 *
 * До него в проекте был один паттерн — `.line` в styles/loading.module.css,
 * то есть скелетон существовал только для маршрутного `loading.tsx`. Из-за
 * этого любая частичная загрузка внутри страницы либо схлопывала вёрстку,
 * либо показывала спиннер, и ощущение скорости терялось: интерфейс кажется
 * быстрым, когда на месте контента заранее стоит его форма.
 *
 * Правила:
 * 1. Скелетон повторяет ФОРМУ и РАЗМЕР того, что подменяет (вариант задаёт
 *    радиус: text / control / surface / circle).
 * 2. Скелетон декоративен: он скрыт от скринридеров (`aria-hidden`), а факт
 *    ожидания сообщает контейнер через `aria-busy` + `SkeletonAnnounce`.
 *    Иначе читалка озвучивает пустые прямоугольники.
 * 3. Размеры — в em/%, чтобы блок масштабировался вместе с типографикой.
 */

type SkeletonVariant = "text" | "control" | "surface" | "circle";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** CSS-значение: "60%", "12ch", "120px". */
  width?: string;
  /** CSS-значение. Для variant="text" по умолчанию — высота строки. */
  height?: string;
  className?: string;
  style?: CSSProperties;
}

function cx(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(styles.base, styles[variant], className)}
      style={{ width, height, ...style }}
    />
  );
}

export interface SkeletonTextProps {
  /** Количество строк. Последняя автоматически короче остальных. */
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cx(styles.stack, className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          variant="text"
          className={index === lines - 1 ? styles.lastLine : undefined}
        />
      ))}
    </div>
  );
}

export interface SkeletonCardProps {
  /** Строк текста под заголовком. */
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 2, className }: SkeletonCardProps) {
  return (
    <div className={cx(styles.card, className)}>
      <Skeleton variant="text" className={styles.cardTitle} />
      <SkeletonText lines={lines} />
    </div>
  );
}

export interface SkeletonListProps {
  count?: number;
  lines?: number;
  className?: string;
}

export function SkeletonList({
  count = 3,
  lines = 2,
  className,
}: SkeletonListProps) {
  return (
    <div className={cx(styles.list, className)}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} lines={lines} />
      ))}
    </div>
  );
}

/**
 * Текстовое сообщение об ожидании для скринридеров.
 *
 * Ставится рядом со скелетоном внутри контейнера с `aria-busy="true"`:
 * скелетоны скрыты от читалки, поэтому без этого узла ожидание для
 * незрячего пользователя выглядит как пустая страница.
 */
export function SkeletonAnnounce({ label = "Загружаем данные" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}
    </p>
  );
}
