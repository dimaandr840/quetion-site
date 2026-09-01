import type { CSSProperties } from "react";
import { SITE_NAME } from "@/lib/site";

export interface LogoProps {
  /** Размер квадратного знака в пикселях. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /**
   * Суффикс id градиента. Два одинаковых id на одной странице ломают заливку,
   * поэтому каждое место использования передаёт свой суффикс (header, footer).
   */
  idSuffix?: string;
  /** Если знак стоит рядом с текстовым названием, его можно спрятать от скринридера. */
  decorative?: boolean;
}

/**
 * Знак Qareer Quest: буква Q как лупа поиска и искра — найденный ответ.
 * Градиент повторяет акцентный индиго дизайн-системы.
 */
export function Logo({
  size = 34,
  className,
  style,
  idSuffix = "default",
  decorative = false,
}: LogoProps) {
  const gradientId = `qq-logo-${idSuffix}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      style={style}
      {...(decorative
        ? { "aria-hidden": true as const, focusable: false }
        : { role: "img", "aria-label": SITE_NAME })}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} />
      <circle cx="22" cy="22" r="9.4" fill="none" stroke="#ffffff" strokeWidth="4.2" />
      <path
        d="M28.4 28.4 L34.6 34.6"
        stroke="#ffffff"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <circle cx="35.2" cy="12.8" r="2.7" fill="#fbbf24" />
    </svg>
  );
}
