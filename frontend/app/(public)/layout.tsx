import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { fetchCategories, fetchQuestions } from "@/lib/content-api";
import { popularTags, topicPills } from "@/lib/queries";

/**
 * На сборке (docker build) API недоступен: контейнер api ещё не запущен и сети
 * compose у сборщика нет. Этот layout ходит в API ради подсказок поиска, то
 * есть от него зависят все публичные страницы — включая полностью статические
 * /legal/*, которые раньше падали на пререндере с ECONNREFUSED и обрывали
 * сборку. Поэтому рендерим по запросу, как и остальные страницы с данными.
 * Кеш при этом сохраняется: в serverFetch у fetch явно задан next.revalidate
 * + тег content, так что база не получает запрос на каждый хит.
 */
export const dynamic = "force-dynamic";

/** Сколько тем показывает поисковый оверлей. */
const TOPIC_LIMIT = 5;

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [questions, categories] = await Promise.all([
    fetchQuestions(),
    fetchCategories(),
  ]);

  return (
    <div className="page">
      <Header
        searchSuggestions={popularTags(questions, 5)}
        searchTopics={topicPills(categories).slice(0, TOPIC_LIMIT)}
      />
      <ScrollProgress />
      <main id="main-content">{children}</main>
      <Footer />
      {/* Баннер только в публичной части: в админке cookie строго служебные. */}
      <CookieConsent />
      {/* Тег грузится сам, но лишь после согласия из баннера выше. */}
      <GoogleAnalytics />
    </div>
  );
}
