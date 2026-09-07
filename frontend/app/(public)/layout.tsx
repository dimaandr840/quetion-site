import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { fetchCategories, fetchQuestions } from "@/lib/content-api";
import { popularTags, topicPills } from "@/lib/queries";

export const dynamic = "force-dynamic";
const TOPIC_LIMIT = 5;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Legal and informational pages must remain reachable during an API outage.
  // Search suggestions are optional presentation data, not a rendering prerequisite.
  const [questionsResult, categoriesResult] = await Promise.allSettled([
    fetchQuestions(),
    fetchCategories(),
  ]);
  const questions = questionsResult.status === "fulfilled" ? questionsResult.value : [];
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];

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
