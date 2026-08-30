import type { Level } from "./types";

export interface AdminQuestionRow {
  slug: string;
  title: string;
  professionSlug: string;
  professionTitle: string;
  categorySlug: string;
  categoryTitle: string;
  level: Level;
  published: boolean;
  /** ISO-время создания из базы. */
  createdAt: string;
}

export interface AdminNavItem {
  href: string;
  label: string;
  icon:
    | "help-circle"
    | "briefcase"
    | "grid"
    | "users"
    | "bar-chart-2";
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/questions", label: "Вопросы", icon: "help-circle" },
  { href: "/admin/professions", label: "Направления", icon: "briefcase" },
  { href: "/admin/categories", label: "Темы", icon: "grid" },
  { href: "/admin/users", label: "Пользователи", icon: "users" },
  { href: "/admin/stats", label: "Статистика", icon: "bar-chart-2" },
];

export const ADMIN_PAGE_SIZE = 10;

/** Дата для таблицы: бэкенд отдаёт ISO, показываем ДД.ММ.ГГГГ. */
export function formatAdminDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}
