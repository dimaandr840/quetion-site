import Link from "next/link";
import { FOOTER_TAGLINE } from "@/lib/content";
import { footerColumns } from "@/lib/nav";
import { SITE_CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { CookieSettingsButton } from "./CookieSettingsButton";
import { Icon } from "../ui/Icon";
import { Logo } from "../ui/Logo";
import styles from "./Footer.module.css";

/** Только рабочие адреса: заглушки на github.com/twitter.com убраны. */
const CONTACTS = [
  {
    name: "share-2" as const,
    label: "Написать нам",
    href: `mailto:${SITE_CONTACT_EMAIL}`,
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="shell">
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <Link href="/" className={styles.brand} aria-label={`${SITE_NAME} — на главную`}>
              <Logo className={styles.logo} idSuffix="footer" decorative />
              <span className={styles.brandName}>
                Qareer<span className={styles.brandAccent}>Quest</span>
              </span>
            </Link>
            <p className={styles.tagline}>{FOOTER_TAGLINE}</p>
          </div>

          <div className={styles.linkCols}>
            {footerColumns.map((column) => (
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
          <p className={styles.copyright}>
            © {year} {SITE_NAME}. Все права защищены.
          </p>

          {/* Ст. 13 GDPR: сведения об обработке должны быть легко доступны с
              любой страницы, поэтому ссылки живут в подвале — рядом с
              возможностью отозвать согласие на cookie. */}
          <ul className={styles.legal}>
            <li>
              <Link href="/legal/privacy" className={styles.legalLink}>
                Политика конфиденциальности
              </Link>
            </li>
            <li>
              <Link href="/legal/cookies" className={styles.legalLink}>
                Cookie
              </Link>
            </li>
            <li>
              <CookieSettingsButton className={styles.legalLink} />
            </li>
          </ul>

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
