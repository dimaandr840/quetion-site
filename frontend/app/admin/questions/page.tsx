import type { Metadata } from "next";
import { AdminQuestionsView } from "@/components/admin/AdminQuestionsView";
import { fetchCategories, fetchProfessions } from "@/lib/content-api";

export const metadata: Metadata = {
  title: "Управление вопросами",
};

export default async function AdminQuestionsPage() {
  // Список вопросов грузится в браузере из /api/admin/questions: он должен
  // показывать то, что реально лежит в базе, включая только что созданное.
  // Справочники профессий и тем читаем из того же API, а не из content.ts.
  const [professionList, categoryList] = await Promise.all([
    fetchProfessions(),
    fetchCategories(),
  ]);

  const professions = professionList.map((profession) => ({
    slug: profession.slug,
    title: profession.title,
  }));
  const categories = categoryList.map((category) => ({
    slug: category.slug,
    title: category.title,
    professionSlug: category.professionSlug,
  }));

  return <AdminQuestionsView professions={professions} categories={categories} />;
}
