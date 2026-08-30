import type { Level } from "@/lib/types";
import styles from "./Badge.module.css";

const LEVEL_CLASS: Record<Level, string> = {
  Junior: styles.junior,
  Middle: styles.middle,
  Senior: styles.senior,
};

export function LevelBadge({ level }: { level: Level }) {
  return <span className={`${styles.badge} ${LEVEL_CLASS[level]}`}>{level}</span>;
}

export function CountBadge({ children }: { children: React.ReactNode }) {
  return <span className={`${styles.badge} ${styles.count}`}>{children}</span>;
}
