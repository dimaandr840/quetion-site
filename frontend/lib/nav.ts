import { FOOTER_COLUMNS, NAV_LINKS } from "./content";

/**
 * Ссылки навигации без удалённых страниц.
 *
 * Страницы «О проекте» больше нет, поэтому её адрес отфильтрован в одном
 * месте: и шапка, и подвал берут ссылки отсюда, а не из content.ts напрямую.
 */
const REMOVED_PATHS = new Set(["/about"]);

export const navLinks = NAV_LINKS.filter((link) => !REMOVED_PATHS.has(link.href));

export const footerColumns = FOOTER_COLUMNS.map((column) => ({
  title: column.title,
  links: column.links.filter((link) => !REMOVED_PATHS.has(link.href)),
})).filter((column) => column.links.length > 0);
