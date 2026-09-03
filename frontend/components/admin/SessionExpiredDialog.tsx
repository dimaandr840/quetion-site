"use client";

import { useEffect, useState } from "react";

import { onSessionExpired, type SessionExpiredDetail } from "@/lib/session-recovery";

/**
 * Диалог «сессия истекла».
 *
 * Смысл не в красивом сообщении, а в том, что страница НЕ редиректит на логин
 * автоматически: в форме может быть несохранённый текст. Решение остаётся за
 * человеком, а черновик к этому моменту уже лежит в sessionStorage.
 */
export function SessionExpiredDialog({ loginPath = "/admin/login" }: { loginPath?: string }) {
  const [detail, setDetail] = useState<SessionExpiredDetail | null>(null);

  useEffect(() => onSessionExpired(setDetail), []);

  if (!detail) return null;

  const href = `${loginPath}?returnTo=${encodeURIComponent(detail.returnTo)}`;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <h2 id="session-expired-title" className="text-lg font-semibold">
          Сессия истекла
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          Введённые данные сохранены как черновик и будут восстановлены после повторного
          входа. Страница не была закрыта автоматически именно поэтому.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm"
            onClick={() => setDetail(null)}
          >
            Остаться на странице
          </button>
          <a
            href={href}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-neutral-900"
          >
            Войти заново
          </a>
        </div>
      </div>
    </div>
  );
}

export default SessionExpiredDialog;
