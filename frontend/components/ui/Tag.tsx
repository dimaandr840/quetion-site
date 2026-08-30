import Link from "next/link";
import styles from "./Tag.module.css";

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className={styles.tag}>{children}</span>;
}

interface PillProps {
  href: string;
  children: React.ReactNode;
  size?: "medium" | "small";
  selected?: boolean;
}

export function Pill({ href, children, size = "medium", selected }: PillProps) {
  const className = [
    styles.pill,
    size === "small" ? styles.pillSmall : "",
    selected ? styles.pillSelected : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
