import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Пользователи" };

export default function AdminUsersPage() {
  return (
    <EmptyState
      emoji="👥"
      headingLevel="h1"
      title="Управление пользователями"
      text="Администратор создаётся автоматически при запуске из настроек окружения. Список и роли пользователей в админке ещё не сделаны."
    />
  );
}
