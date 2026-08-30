import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import styles from "./Breadcrumbs.module.css";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Визуальные крошки и BreadcrumbList JSON-LD живут в одном компоненте:
 * разметка физически не может рассинхронизироваться с тем, что видит пользователь.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema(items)} />
      <nav aria-label="Хлебные крошки">
        <ol className={styles.breadcrumbs}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={`${item.label}-${index}`} className={styles.item}>
                {item.href && !isLast ? (
                  <Link href={item.href} className={styles.link}>
                    {item.label}
                  </Link>
                ) : (
                  <span className={styles.current} aria-current={isLast ? "page" : undefined}>
                    {item.label}
                  </span>
                )}
                {!isLast && (
                  <span className={styles.separator} aria-hidden="true">
                    {" "}
                    &gt;{" "}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
