import Link from "next/link";
import { AdminProfile } from "./AdminProfile";
import { LogoutButton } from "./LogoutButton";
import { AUTH_ENABLED } from "@/lib/flags";
import styles from "./AdminHeader.module.css";

export function AdminHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          D
        </span>
        <span className={styles.brandGroup}>
          <span className={styles.brandName}>DevPrep</span>
          <span className={styles.adminTag}>АДМИН-ПАНЕЛЬ</span>
        </span>
      </Link>

      <div className={styles.controls}>
        {AUTH_ENABLED ? (
          <>
            <AdminProfile />
            <span className={styles.divider} aria-hidden="true" />
            <LogoutButton />
          </>
        ) : (
          <div className={styles.profile}>
            <span className={styles.avatar} aria-hidden="true">
              А
            </span>
            <span className={styles.profileName}>Администратор</span>
          </div>
        )}
      </div>
    </header>
  );
}
