"use client";

import Script from "next/script";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { hasAnalyticsConsent, subscribeConsent } from "@/lib/consent";

/**
 * Google Analytics 4 строго по согласию.
 *
 * § 25(1) TDDDG и ст. 6(1)(a) GDPR: доступ к данным в устройстве без технической
 * необходимости требует явного согласия. Поэтому тег не просто «выключен
 * флагом»: скрипт вообще не запрашивается, пока пользователь не нажал
 * «Принять все» — до этого к Google не уходит ни один запрос, а значит, не
 * раскрывается и IP-адрес посетителя.
 *
 * Отзыв согласия (ст. 7(3) GDPR) тоже должен быть реальным, поэтому при отказе
 * тег глушится флагом ga-disable-* и cookie _ga* удаляются.
 *
 * Согласие живёт в cookie — это внешнее состояние, поэтому оно читается
 * через useSyncExternalStore. Эффект оставлен ровно для того, для чего он нужен:
 * синхронизации внешних систем (флаг gtag и cookie), без setState в теле.
 *
 * Идентификатор берётся из NEXT_PUBLIC_GA_ID. Переменная читается на сборке,
 * поэтому в compose её нужно передать и build arg‘ом — так же, как
 * NEXT_PUBLIC_MEDIA_BASE_URL. Если переменной нет, компонент не рендерит ничего:
 * локальная разработка и стенды остаются без аналитики.
 *
 * Важно: публичная CSP в nginx/nginx.conf должна разрешать googletagmanager и
 * google-analytics, иначе согласие есть, а скрипт блокирует браузер.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

const GTAG_ORIGIN = "https://www.googletagmanager.com";

/** На сервере согласия нет по определению: решение не должно попасть в кеш. */
const hasAnalyticsConsentOnServer = () => false;

/**
 * Window не имеет индексной подписи, поэтому пересечение с Record<string, unknown>
 * несовместимо с Window & typeof globalThis напрямую (TS2352). Пишем флаги
 * ga-disable-* через отдельный хелпер с приведением через unknown — это
 * единственное место, где нужен «динамический» доступ к window.
 */
function setGaDisableFlag(gaId: string, disabled: boolean): void {
  (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] =
    disabled;
}

/** Удаляем cookie Google на всех вариантах домена: точный нам не известен. */
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
    if (!name.startsWith("_ga")) continue;

    document.cookie = `${name}=; Path=/; Max-Age=0`;
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Domain=${domain}; Max-Age=0`;
    }
  }
}

export function GoogleAnalytics() {
  const granted = useSyncExternalStore(
    subscribeConsent,
    hasAnalyticsConsent,
    hasAnalyticsConsentOnServer
  );

  const revoke = useCallback(() => {
    if (!GA_ID) return;
    setGaDisableFlag(GA_ID, true);
    dropAnalyticsCookies();
  }, []);

  useEffect(() => {
    if (!GA_ID) return;

    if (granted) {
      setGaDisableFlag(GA_ID, false);
      return;
    }

    revoke();
  }, [granted, revoke]);

  if (!GA_ID || !granted) return null;

  const gaSrc = GTAG_ORIGIN + "/gtag/js?id=" + encodeURIComponent(GA_ID);

  return (
    <>
      <Script src={gaSrc} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {[
          "window.dataLayer = window.dataLayer || [];",
          "function gtag(){window.dataLayer.push(arguments);}",
          "gtag('js', new Date());",
          // Consent Mode v2: рекламные режимы всегда denied — мы на них согласия
          // не спрашиваем и рекламу не показываем.
          "gtag('consent', 'default', {" +
            "ad_storage: 'denied'," +
            "ad_user_data: 'denied'," +
            "ad_personalization: 'denied'," +
            "analytics_storage: 'granted'" +
            "});",
          "gtag('config', '" +
            GA_ID +
            "', {" +
            " anonymize_ip: true," +
            " allow_google_signals: false," +
            " allow_ad_personalization_signals: false" +
            " });",
        ].join("\n")}
      </Script>
    </>
  );
}
