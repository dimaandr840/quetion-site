import { AdminCategoriesView } from "@/components/admin/AdminCategoriesView";
import { fetchCategories, fetchProfessions } from "@/lib/content-api";

export const metadata = { title: "Темы" };

export default async function AdminCategoriesPage() {
  const [professions, categories] = await Promise.all([
    fetchProfessions(),
    fetchCategories(),
  ]);

  return <AdminCategoriesView professions={professions} categories={categories} />;
}
