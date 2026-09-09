import type { Metadata } from "next";
import { BulkImportView } from "@/components/admin/BulkImportView";

export const metadata: Metadata = {
  title: "Импорт вопросов",
};

/**
 * Экран массовой загрузки. Данные не готовятся на сервере: справочники и
 * существующие вопросы нужны уже после выбора файла, и брать их надо свежими —
 * импорт может идти сразу после ручного добавления вопроса.
 */
export default function AdminImportPage() {
  return <BulkImportView />;
}
