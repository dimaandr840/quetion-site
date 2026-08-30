import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Статистика" };

export default function AdminStatsPage() {
  return (
    <EmptyState
      emoji="📊"
      headingLevel="h1"
      title="Статистика платформы"
      text="Сбор метрик ещё не подключён, поэтому показывать цифры нечего. Количество вопросов по направлениям видно на публичных страницах."
    />
  );
}
