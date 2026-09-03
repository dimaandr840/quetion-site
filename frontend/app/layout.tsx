import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import { RouteFocus } from "@/components/a11y/RouteFocus";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteSchema } from "@/lib/schema";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import "@/styles/globals.css";
/* Слой 4 подключается после globals.css: он переопределяет тени, фактуру фона
   и обводку фокуса, поэтому порядок импорта здесь значим. */
import "@/styles/quiet.css";

/**
 * Шрифты. Сайт полностью на русском (lang="ru"), поэтому кириллический
 * сабсет обязателен: без него браузер отдаёт кириллицу системному фолбэку,
 * а next/font считает шрифт загруженным — отсюда рассинхрон метрик и CLS.
 *
 * Outfit заменён на Manrope: у Outfit кириллицы нет в принципе, то есть весь
 * русский текст в заголовках рендерился не тем шрифтом, который заявлен в
 * дизайн-системе. DM Sans заменён на Inter по той же причине.
 *
 * Все три — variable-шрифты, поэтому weight не указываем: подгружается одна
 * вариативная ось вместо набора статических файлов.
 */
const display = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["cyrillic", "latin"],
  variable: "--font-sans",
  display: "swap",
});

/** Моно нужен только для кода ниже первого экрана — preload снят. */
const mono = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  // metadataBase делает все canonical и OG-URL абсолютными.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — вопросы и ответы для IT-собеседований`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "ru_RU",
    title: `${SITE_NAME} — вопросы и ответы для IT-собеседований`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — вопросы и ответы для IT-собеседований`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/**
 * theme-color задаём отдельно для светлой и тёмной схемы: иначе адресная
 * строка мобильного браузера остаётся светлой при тёмной теме сайта.
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      data-theme="light"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <JsonLd data={siteSchema()} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Перейти к содержанию
        </a>
        {/* Переносит фокус в <main> после смены маршрута. */}
        <RouteFocus />
        {children}
      </body>
    </html>
  );
}
