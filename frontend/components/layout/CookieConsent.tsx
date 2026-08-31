"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  CONSENT_OPEN_EVENT,
  readConsent,
  writeConsent,
} from "@/lib/consent";
import styles from "./CookieConsent.module.css";

/**
 * Баннер согласия на cookie.
 *
 * Две равнозначные кнопки без тёмных паттернов: отказаться должно быть
 * ровно так же просто, как согласиться. Крестика «закрыть без выбора» нет
 * намеренно: молчание не является согласием, а баннер без решения
 * не должен исчезать.
 *
 * Никаких счётчиков компонент не грузит — он только фиксирует решение и
 * шлёт событие. Код метрики подключается к hasAnalyticsConsent().
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Состояние читается только на клиенте: иначе баннер попадёт в кеш страницы.
    if (!readConsent()) setOpen(true);

    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  const decide = useCallback((analytics: boolean) => {
    writeConsent(analytics);
    setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div
      className={styles.banner}
      role="dialog"
      aria-live="polite"
      aria-label="Использование cookie"
    >
      <div className={styles.inner}>
        <div className={styles.text}>
          <p className={styles.title}>Мы используем cookie</p>
          <p className={styles.description}>
            Технически необходимые cookie нужны для работы сайта — без них
            не работает вход и выбор темы. Аналитические cookie мы ставим
            только с вашего согласия. Подробности — в{" "}
            <Link href="/privacy" className={styles.link}>
              политике обработки персональных данных
            </Link>
            .
          </p>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => decide(false)}
          >
            Только необходимые
          </Button>
          <Button type="button" onClick={() => decide(true)}>
            Принять все
          </Button>
        </div>
      </div>
    </div>
  );
}
