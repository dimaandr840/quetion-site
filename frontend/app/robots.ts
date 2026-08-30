import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Важно: robots.txt НЕ используется для борьбы с дублями ?level/?sort/?page —
 * закрытые от сканирования URL не могут передать сигналы по canonical.
 * Фасеты консолидируются тегом rel=canonical (lib/seo.ts).
 * Здесь закрываем только то, что вообще не должно сканироваться.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/login",
          "/api/",
          // Внутренний поиск: бесконечные тонкие страницы по ?q=.
          "/search",
          "/search?",
        ],
      },
    ],
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
