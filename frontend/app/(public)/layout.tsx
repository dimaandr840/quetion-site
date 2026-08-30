import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { fetchCategories, fetchQuestions } from "@/lib/content-api";
import { popularTags, topicPills } from "@/lib/queries";

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
    </div>
  );
}
