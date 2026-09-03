"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

interface Dependency {
  name: string;
  state: "UP" | "DOWN" | "DISABLED" | "UNKNOWN";
  checkedAt: string | null;
  detail: string | null;
}

const LABELS: Record<string, string> = {
  search: "Поиск (Meilisearch)",
  media: "Хранилище картинок (S3)",
  mail: "Почта (SMTP)",
};

const STATE_LABELS: Record<Dependency["state"], string> = {
  UP: "Работает",
  DOWN: "Не работает",
  DISABLED: "Выключено",
  UNKNOWN: "Нет данных",
};

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
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!items) {
    return <p className="text-sm text-neutral-500">Загрузка статуса…</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.name}
          className="flex items-start justify-between gap-4 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
        >
          <span>
            <b>{LABELS[item.name] ?? item.name}</b>
            {item.detail ? (
              <span className="block text-neutral-500">{item.detail}</span>
            ) : null}
          </span>
          <span
            className={
              item.state === "DOWN"
                ? "text-red-600"
                : item.state === "UP"
                  ? "text-green-600"
                  : "text-neutral-500"
            }
          >
            {STATE_LABELS[item.state]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default IntegrationStatusPanel;
