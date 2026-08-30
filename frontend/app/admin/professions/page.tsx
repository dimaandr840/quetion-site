import { AdminProfessionsView } from "@/components/admin/AdminProfessionsView";
import { fetchIndustries, fetchProfessions } from "@/lib/content-api";

export const metadata = { title: "Направления" };

export default async function AdminProfessionsPage() {
  const [professions, industries] = await Promise.all([
    fetchProfessions(),
    fetchIndustries(),
  ]);

  return <AdminProfessionsView professions={professions} industries={industries} />;
}
