"use client";

import { useEffect, useState } from "react";

import { onSessionExpired, type SessionExpiredDetail } from "@/lib/session-recovery";
import styles from "./SessionExpiredDialog.module.css";

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
      className={styles.backdrop}
    >
      <div className={styles.dialog}>
        <h2 id="session-expired-title" className={styles.title}>
          Сессия истекла
        </h2>
        <p className={styles.text}>
          Введённые данные сохранены как черновик и будут восстановлены после повторного
          входа. Страница не была закрыта автоматически именно поэтому.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => setDetail(null)}>
            Остаться на странице
          </button>
          <a href={href} className={styles.primary}>
            Войти заново
          </a>
        </div>
      </div>
    </div>
  );
}

export default SessionExpiredDialog;
