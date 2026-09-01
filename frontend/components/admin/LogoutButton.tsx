"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../ui/Icon";
import { logout } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/routes";
import styles from "./AdminHeader.module.css";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await logout();
    } catch {
      // Даже если запрос не дошёл, уводим со страницы: cookie либо уже
      // очищены сервером, либо истекут сами. Держать пользователя в админке
      // после нажатия «Выйти» хуже, чем показать экран входа.
    } finally {
      router.replace(ADMIN_LOGIN_PATH);
      // Сбрасываем закешированные серверные payload'ы админки.
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className={styles.logout}
      onClick={onClick}
      disabled={pending}
    >
      <Icon name="log-out" size={16} />
      {pending ? "Выходим..." : "Выйти"}
    </button>
  );
}
