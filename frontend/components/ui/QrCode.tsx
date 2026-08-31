"use client";

import { useMemo } from "react";
import { encodeQr } from "@/lib/qr";

interface QrCodeProps {
  /** Данные для кода. Для привязки 2FA это otpauth-ссылка. */
  value: string;
  /** Сторона картинки в пикселях. */
  size?: number;
  /** Текстовое описание для скринридера. */
  label: string;
}

/** Отступ вокруг кода в модулях: без него камеры хуже находят код. */
const QUIET_ZONE = 4;

/**
 * QR-код в виде SVG. Считается на клиенте, картинка не уходит в сеть,
 * поэтому секрет остаётся в пределах страницы входа.
 */
export function QrCode({ value, size = 208, label }: QrCodeProps) {
  const code = useMemo(() => {
    const matrix = encodeQr(value);
    if (!matrix) {
      return null;
    }
    const side = matrix.length + QUIET_ZONE * 2;
    const path = matrix
      .flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z` : ""
        )
      )
      .join("");
    return { side, path };
  }, [value]);

  if (!code) {
    return null;
  }

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${code.side} ${code.side}`}
      shapeRendering="crispEdges"
    >
      <rect width={code.side} height={code.side} fill="#ffffff" />
      <path d={code.path} fill="#000000" />
    </svg>
  );
}
