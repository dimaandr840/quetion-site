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
 * необходимости требует явного согласия. Поэтому тег не просто «выключен» —
 * скрипт вообще не запрашивается, пока пользователь не нажал «Принять все».
 * Так же работает и отзыв: тег глушится флагом ga-disable-* и cookie _ga
 * удаляются, чтобы отказ не оставался формальным.
 *
 * Идентификатор берётся из NEXT_PUBLIC_GA_ID. Если переменной нет,
 * компонент не рендерит ничего — локальная разработка остаётся чистой.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();

type WindowWithFlags = Window & Record<string, unknown>;

/** Удаляем cookie Google на всех вариантах домена: точного мы не знаем. */
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

    // Читаем решение только на клиенте: иначе оно попадёт в кеш страницы.
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

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {[
          "window.dataLayer = window.dataLayer || [];",
          "function gtag(){window.dataLayer.push(arguments);}",
          "gtag('js', new Date());",
          "gtag('consent', 'default', {" +
            "ad_storage: 'denied'," +
            "ad_user_data: 'denied'," +
            "ad_personalization: 'denied'," +
            "analytics_storage: 'granted'" +
            "});",
          `gtag('config', '${GA_ID}', { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });`,
        ].join("\n")}
      </Script>
    </>
  );
}
