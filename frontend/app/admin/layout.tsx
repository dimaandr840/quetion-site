import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
