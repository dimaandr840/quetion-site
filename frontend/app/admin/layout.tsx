import type { Metadata } from "next";
import { headers } from "next/headers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ADMIN_LOGIN_PATH, PATHNAME_HEADER } from "@/lib/routes";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: {
    default: "Админ-панель | DevPrep",
    template: "%s | Админ-панель DevPrep",
  },
  robots: { index: false, follow: false },
};

/**
 * Необходимо для CSP с nonce (frontend/proxy.ts): nonce выдаётся на запрос,
 * а в пререндеренный HTML его подставить некуда. Потери без него нет:
 * админка всё равно отдаётся с Cache-Control: no-store.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * Страницы входа живут внутри /admin, чтобы адрес админки можно было
   * спрятать целиком, одним сегментом. Но оболочка с шапкой и меню до
   * авторизации показывать нельзя: она раскрывает структуру разделов и
   * ведёт на страницы, которые всё равно ответят редиректом.
   *
   * Путь берём из заголовка, который ставит proxy.ts: серверный layout не
   * видит pathname напрямую.
   */
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "";
  const isAuthRoute =
    pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className={styles.shell}>
      <AdminHeader />
      <div className={styles.main}>
        <AdminSidebar />
        <main id="main-content" className={styles.workspace}>
          {children}
        </main>
      </div>
    </div>
  );
}
