"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import {
  CONSENT_CHANGE_EVENT,
  hasAnalyticsConsent,
  type ConsentState,
} from "@/lib/consent";

/**
 * Google Analytics 4 строго по согласию.
 *
 * § 25(1) TDDDG и ст. 6(1)(a) GDPR: доступ к данным в устройстве без
 * технической необходимости требует явного согласия. Поэтому тег не просто
 * «выключен флагом»: скрипт вообще не запрашивается, пока пользователь не
 * нажал «Принять все» — до этого к Google не уходит ни один запрос, а значит
 * и IP-адрес посетителя не раскрывается.
 *
 * Отзыв согласия (ст. 7(3) GDPR) тоже должен быть реальным, поэтому при
 * отказе тег глушится флагом ga-disable-* и cookie _ga* удаляются.
 *
 * Идентификатор берётся из NEXT_PUBLIC_GA_ID (читается на сборке, поэтому в
 * compose его нужно передать и build arg‘ом, как NEXT_PUBLIC_MEDIA_BASE_URL). Если
 * переменной нет, компонент не рендерит ничего — локальная разработка и
 * стенды остаются без аналитики.
 *
 * Важно: публичная CSP в nginx/nginx.conf должна разрешать googletagmanager и
 * google-analytics, иначе согласие есть, а скрипт блокирует браузер.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

type WindowWithFlags = Window & Record<string, unknown>;

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
  const [granted, setGranted] = useState(false);

  const revoke = useCallback(() => {
    if (!GA_ID) return;
    (window as WindowWithFlags)[`ga-disable-${GA_ID}`] = true;
    dropAnalyticsCookies();
  }, []);

  useEffect(() => {
    if (!GA_ID) return;

    // Решение читается только на клиенте: иначе оно попадёт в кеш страницы.
    setGranted(hasAnalyticsConsent());

    const onChange = (event: Event) => {
      const state = (event as CustomEvent<ConsentState>).detail;

      if (state?.analytics === true) {
        (window as WindowWithFlags)[`ga-disable-${GA_ID}`] = false;
        setGranted(true);
        return;
      }

      revoke();
      setGranted(false);
    };

    window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  }, [revoke]);

  if (!GA_ID || !granted) return null;

  const gaSrc = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;

  return (
    <>
      <Script src={gaSrc} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {[
          "window.dataLayer = window.dataLayer || [];",
          "function gtag(){window.dataLayer.push(arguments);}",
          "gtag('js', new Date());",
          // Consent Mode v2: рекламные режимы остаются denied всегда — мы на них
          // согласия не спрашиваем и рекламу не показываем.
          "gtag('consent', 'default', {" +
            "ad_storage: 'denied'," +
            "ad_user_data: 'denied'," +
            "ad_personalization: 'denied'," +
            "analytics_storage: 'granted'" +
            "});",
          `gtag('config', '${GA_ID}', {` +
            " anonymize_ip: true," +
            " allow_google_signals: false," +
            " allow_ad_personalization_signals: false" +
            " });",
        ].join("\n")}
      </Script>
    </>
  );
}
