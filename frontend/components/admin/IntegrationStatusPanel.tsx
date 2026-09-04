"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import styles from "./IntegrationStatusPanel.module.css";

type State = "UP" | "DOWN" | "DISABLED" | "UNKNOWN";

interface Dependency {
  name: string;
  state: State;
  checkedAt: string | null;
  detail: string | null;
}

const LABELS: Record<string, string> = {
  search: "Поиск (Meilisearch)",
  media: "Хранилище картинок (S3)",
  mail: "Почта (SMTP)",
};

const STATE_LABELS: Record<State, string> = {
  UP: "Работает",
  DOWN: "Не работает",
  DISABLED: "Выключено",
  UNKNOWN: "Нет данных",
};

function stateClass(state: State): string {
  if (state === "UP") return `${styles.state} ${styles.up}`;
  if (state === "DOWN") return `${styles.state} ${styles.down}`;
  return `${styles.state} ${styles.muted}`;
}

/**
 * Статус внешних зависимостей в админке.
 *
 * До этого отказ SMTP был виден только в логах контейнера: письма молча не уходили,
 * и администратор узнавал об этом от пользователя, который не получил код.
 */
export function IntegrationStatusPanel() {
  const [items, setItems] = useState<Dependency[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiFetch<{ dependencies: Dependency[] }>("/admin/status");
        if (!cancelled) {
          setItems(data.dependencies);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Не удалось получить статус интеграций");
      }
    };

    void load();
    // 30 секунд совпадают с интервалом проверки на бэкенде (SEARCH_HEALTH_INTERVAL):
    // чаще опрашивать бессмысленно, данные не обновятся.
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }
  if (!items) {
    return <p className={styles.muted}>Загрузка статуса…</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.name} className={styles.item}>
          <span>
            <span className={styles.name}>{LABELS[item.name] ?? item.name}</span>
            {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
          </span>
          <span className={stateClass(item.state)}>{STATE_LABELS[item.state]}</span>
        </li>
      ))}
    </ul>
  );
}

export default IntegrationStatusPanel;
