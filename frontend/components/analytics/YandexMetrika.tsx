"use client";

import Script from "next/script";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { hasAnalyticsConsent, subscribeConsent } from "@/lib/consent";

/**
 * Яндекс Метрика строго по согласию.
 *
 * Пришла на место Google Analytics 4: GA4 отправляет IP и идентификаторы
 * посетителей в Google LLC (США), а это трансграничная передача по ст. 12
 * 152-ФЗ с отдельным уведомлением РКН. Метрика — российский обработчик,
 * поэтому передача остаётся внутри РФ.
 *
 * cookie аналитики в РФ рассматриваются как персональные данные, когда
 * позволяют косвенно идентифицировать посетителя или строить поведенческий
 * профиль, поэтому счётчик не просто «выключен флагом»: скрипт вообще не
 * запрашивается, пока посетитель не нажал «Принять все» — до этого к
 * mc.yandex.ru не уходит ни одного запроса, а значит, не раскрывается и IP.
 *
 * Вебвизор отключён осознанно (`webvisor: false`): он записывает действия на
 * странице целиком, включая ввод в поля форм, то есть легко собирает
 * персональные данные, которые мы собирать не собирались. Рекламные
 * сценарии (`ecommerce`, отправка в Яндекс Директ) тоже не включаются.
 *
 * Согласие живёт в cookie — это внешнее состояние, поэтому оно читается
 * через useSyncExternalStore. Эффект оставлен ровно для того, для чего нужен:
 * синхронизации внешних систем (флаг отказа и cookie), без setState в теле.
 *
 * Номер счётчика берётся из NEXT_PUBLIC_YM_ID. Переменная читается на сборке,
 * поэтому в compose она передаётся и build arg‘ом — так же, как
 * NEXT_PUBLIC_MEDIA_BASE_URL. Если переменной нет, компонент не рендерит ничего:
 * локальная разработка и стенды остаются без аналитики.
 *
 * Важно: публичная CSP в nginx/nginx.conf должна разрешать mc.yandex.ru,
 * иначе согласие есть, а скрипт блокирует браузер.
 */
const YM_ID = process.env.NEXT_PUBLIC_YM_ID?.trim();

const YM_TAG_SRC = "https://mc.yandex.ru/metrika/tag.js";

/** На сервере согласия нет по определению: решение не должно попасть в кеш. */
const hasAnalyticsConsentOnServer = () => false;

/**
 * Window не имеет индексной подписи, поэтому флаг отказа пишем через
 * приведение через unknown — это единственное место с динамическим
 * доступом к window. disableYaCounter<id> — штатный флаг Метрики для отказа.
 */
function setYmDisableFlag(counterId: string, disabled: boolean): void {
  (window as unknown as Record<string, unknown>)[
    `disableYaCounter${counterId}`
  ] = disabled;
}

/** Удаляем cookie Метрики на всех вариантах домена: точный нам не известен. */
function dropAnalyticsCookies(): void {
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = new Set<string>([host, `.${host}`]);

  if (parts.length > 2) {
    const base = parts.slice(-2).join(".");
    domains.add(base);
    domains.add(`.${base}`);
  }

  for (const pair of document.cookie.split("; ")) {
    const name = pair.split("=")[0];
    // _ym_* — собственные cookie счётчика, yabs-sid — сессионная cookie Яндекса.
    if (!name.startsWith("_ym") && name !== "yabs-sid") continue;

    document.cookie = `${name}=; Path=/; Max-Age=0`;
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Domain=${domain}; Max-Age=0`;
    }
  }
}

export function YandexMetrika() {
  const granted = useSyncExternalStore(
    subscribeConsent,
    hasAnalyticsConsent,
    hasAnalyticsConsentOnServer
  );

  const revoke = useCallback(() => {
    if (!YM_ID) return;
    setYmDisableFlag(YM_ID, true);
    dropAnalyticsCookies();
  }, []);

  useEffect(() => {
    if (!YM_ID) return;

    if (granted) {
      setYmDisableFlag(YM_ID, false);
      return;
    }

    revoke();
  }, [granted, revoke]);

  if (!YM_ID || !granted) return null;

  return (
    <>
      {/*
        Очередь ym() создаётся до загрузки tag.js: скрипт счётчика
        разбирает её при инициализации, поэтому порядок загрузки не важен.
      */}
      <Script id="ym-init" strategy="afterInteractive">
        {[
          "window.ym = window.ym || function () {",
          "  (window.ym.a = window.ym.a || []).push(arguments);",
          "};",
          "window.ym.l = 1 * new Date();",
          "ym(" +
            YM_ID +
            ", 'init', {" +
            " clickmap: true," +
            " trackLinks: true," +
            " accurateTrackBounce: true," +
            // Вебвизор пишет содержимое страницы и полей форм — не включаем.
            " webvisor: false" +
            " });",
        ].join("\n")}
      </Script>
      <Script src={YM_TAG_SRC} strategy="afterInteractive" />
    </>
  );
}
