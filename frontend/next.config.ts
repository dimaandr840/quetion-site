import type { NextConfig } from "next";

/**
 * Заголовки безопасности дублируем на уровне приложения, а не только nginx:
 * при локальном запуске, превью-стенде или если фронт поставить за другим
 * балансировщиком защита не должна исчезать. nginx выставляет те же значения
 * через add_header — повтор безопасен, так как значения совпадают.
 * CSP здесь нет сознательно: для /admin и /login её выдаёт proxy.ts с nonce,
 * для публичных страниц — nginx.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Не рассказываем сканерам версию и стек в X-Powered-By.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Страницы админки и входа не кэшируем нигде и не индексируем.
        source: "/:path(admin|login)/:rest*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
  // Современные браузеры берут иконку из <link rel="icon" href="/icon.svg">,
  // но краулеры и старые клиенты по-прежнему запрашивают /favicon.ico вслепую.
  // Именно rewrite, а не redirect: CSP-директива upgrade-insecure-requests
  // подняла бы абсолютный Location до https и оборвала соединение.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

export default nextConfig;
