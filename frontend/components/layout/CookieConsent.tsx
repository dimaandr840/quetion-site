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
 * ровно так же просто, как согласиться — этого требует § 25 TDDDG и
 * практика надзорных органов ЕС. Крестика «закрыть без выбора» нет
 * намеренно: молчание не является согласием, а баннер без решения
 * не должен исчезать.
 *
 * Никаких счётчиков компонент не грузит — он только фиксирует решение и
 * шлёт событие. Загрузку GA4 по этому событию делает
 * components/analytics/GoogleAnalytics.tsx.
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
            не работает вход и выбор темы. Аналитику Google Analytics мы
            подключаем только с вашего согласия и не подключаем при отказе.
            Подробности — в{" "}
            <Link href="/legal/cookies" className={styles.link}>
              политике cookie
            </Link>{" "}
            и{" "}
            <Link href="/legal/privacy" className={styles.link}>
              политике конфиденциальности
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
