import Link from "next/link";
import styles from "@/styles/list.module.css";

interface PaginationProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
  /** Параметры, которые нужно сохранить при переходе между страницами. */
  extraParams?: Record<string, string | string[] | undefined>;
}

function buildHref(
  basePath: string,
  page: number,
  extraParams: PaginationProps["extraParams"]
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else if (value) {
      search.set(key, value);
    }
  }

  if (page > 1) search.set("page", String(page));

  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Компактный список страниц: первая, последняя и окно вокруг текущей. */
function pageItems(currentPage: number, totalPages: number): Array<number | "gap"> {
  const pages = new Set<number>([1, totalPages, currentPage]);

  if (currentPage - 1 > 1) pages.add(currentPage - 1);
  if (currentPage + 1 < totalPages) pages.add(currentPage + 1);

  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<number | "gap"> = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) items.push("gap");
    items.push(page);
  });

  return items;
}

export function Pagination({
  basePath,
  currentPage,
  totalPages,
  extraParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Пагинация">
      {pageItems(currentPage, totalPages).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className={styles.pageEllipsis} aria-hidden="true">
            …
          </span>
        ) : item === currentPage ? (
          <span
            key={item}
            className={`${styles.pageButton} ${styles.pageButtonActive}`}
            aria-current="page"
          >
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(basePath, item, extraParams)}
            className={styles.pageButton}
            aria-label={`Страница ${item}`}
          >
            {item}
          </Link>
        )
      )}
    </nav>
  );
}
