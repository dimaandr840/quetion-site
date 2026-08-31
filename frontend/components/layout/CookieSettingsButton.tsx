"use client";

import { openCookieSettings } from "@/lib/consent";

/**
 * Отозвать или изменить согласие пользователь должен мочь так же легко,
 * как дать его, поэтому в подвале есть постоянная точка входа.
 */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      Настройки cookie
    </button>
  );
}
