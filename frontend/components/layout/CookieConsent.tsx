"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_OPEN_EVENT, readConsent, writeConsent } from "@/lib/consent";
import styles from "./CookieConsent.module.css";

/**
 * Баннер согласия на cookie.
 *
 * У баннера нет крестика «закрыть» и нет кнопки-умолчания: закрытие без
 * выбора нельзя трактовать как согласие, а отказ должен даваться так же
 * легко, как и согласие — отсюда две равнозначные кнопки рядом.
 *
 * Баннер ничего не блокирует: содержимое сайта общедоступно, и доступ
 * к нему не обусловлен согласием на необязательные cookie.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Читаем только после монтирования: на сервере cookie клиента не видно,
    // и рендер баннера в серверной разметке ломал бы гидратацию.
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
      role="region"
      aria-labelledby="cookie-consent-title"
    >
      <div className={`shell ${styles.inner}`}>
        <div className={styles.texts}>
          <p className={styles.title} id="cookie-consent-title">
            Мы используем cookie
          </p>
          <p className={styles.text}>
            Необходимые cookie нужны для работы сайта и ставятся всегда.
            Аналитические — только с вашего согласия. Подробности — в{" "}
            <Link href="/privacy#cookies" className={styles.link}>
              политике обработки персональных данных
            </Link>
            .
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.decline}
            onClick={() => decide(false)}
          >
            Только необходимые
          </button>
          <button
            type="button"
            className={styles.accept}
            onClick={() => decide(true)}
          >
            Принять все
          </button>
        </div>
      </div>
    </div>
  );
}
