import Link from "next/link";
import { FOOTER_COLUMNS, FOOTER_TAGLINE } from "@/lib/content";
import { Icon } from "../ui/Icon";
import styles from "./Footer.module.css";

/** Только рабочие адреса: заглушки на github.com/twitter.com убраны. */
const CONTACTS = [
  {
    name: "help-circle" as const,
    label: "О проекте",
    href: "/about",
  },
  {
    name: "share-2" as const,
    label: "Написать нам",
    href: "mailto:hello@devprep.local",
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="shell">
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <Link href="/" className={styles.brand}>
              <span className={styles.logo} aria-hidden="true">
                D
              </span>
              <span className={styles.brandName}>DevPrep</span>
            </Link>
            <p className={styles.tagline}>{FOOTER_TAGLINE}</p>
          </div>

          <div className={styles.linkCols}>
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className={styles.colTitle}>{column.title}</p>
                <ul className={styles.colList}>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={styles.colLink}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>© {year} DevPrep. Все права защищены.</p>
          <ul className={styles.socials}>
            {CONTACTS.map((contact) => (
              <li key={contact.name}>
                <a
                  href={contact.href}
                  aria-label={contact.label}
                  className={styles.socialLink}
                >
                  <Icon name={contact.name} size={20} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
