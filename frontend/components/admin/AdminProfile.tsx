"use client";

import { useEffect, useState } from "react";
import { me } from "@/lib/auth";
import styles from "./AdminHeader.module.css";

/**
 * Профиль в шапке админки. Имя берётся из GET /api/me: запрос идёт из браузера,
 * потому что access-токен лежит в httpOnly-cookie и доступен только по запросу
 * с credentials. До ответа показываем нейтральную подпись, а не выдуманное имя.
 */
export function AdminProfile() {
  const [name, setName] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    me()
      .then((user) => {
        if (!active) return;
        setName(user.displayName || user.email);
        setRoles(user.roles);
      })
      .catch(() => {
        // Сессия могла истечь — proxy.ts уведёт на /login при следующем переходе.
      });
    return () => {
      active = false;
    };
  }, []);

  const label = name ?? "Администратор";
  const suffix = roles.includes("ROLE_ADMIN") ? " (Admin)" : "";

  return (
    <div className={styles.profile}>
      <span className={styles.avatar} aria-hidden="true">
        {label.trim().charAt(0).toLocaleUpperCase("ru")}
      </span>
      <span className={styles.profileName}>
        {label}
        {suffix}
      </span>
    </div>
  );
}
