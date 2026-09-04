"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  CONSENT_OPEN_EVENT,
  hasStoredConsent,
  subscribeConsent,
  writeConsent,
} from "@/lib/consent";
import styles from "./CookieConsent.module.css";

/**
 * На сервере считаем решение принятым: иначе баннер попадёт в кеш страницы.
 * После гидрации useSyncExternalStore берёт настоящее значение из cookie.
 */
const hasStoredConsentOnServer = () => true;

/**
 * Баннер согласия на cookie.
 *
 * Две равнозначные кнопки без тёмных паттернов: отказаться должно быть
 * ровно так же просто, как согласиться — этого требует § 25 TDDDG и
 * практика надзорных органов ЕС. Крестика «закрыть без выбора» нет
 * намеренно: молчание не является согласием, а баннер без решения
 * не должен исчезать.
 *
 * Cookie согласия — внешнее состояние, поэтому она читается через
 * useSyncExternalStore, а не переносится в состояние React эффектом:
 * setState в теле эффекта даёт каскадный рендер (react-hooks/set-state-in-effect).
 *
 * Никаких счётчиков компонент не грузит — он только фиксирует решение и
 * шлёт событие. Загрузку GA4 по этому событию делает
 * components/analytics/GoogleAnalytics.tsx.
 */
export function CookieConsent() {
  const decided = useSyncExternalStore(
    subscribeConsent,
    hasStoredConsent,
    hasStoredConsentOnServer
  );
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    // Состояние меняется только в колбэке подписки, а не в теле эффекта.
    const reopen = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  const decide = useCallback((analytics: boolean) => {
    // writeConsent шлёт CONSENT_CHANGE_EVENT — снимок согласия обновится сам.
    writeConsent(analytics);
    setReopened(false);
  }, []);

  if (decided && !reopened) return null;

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
