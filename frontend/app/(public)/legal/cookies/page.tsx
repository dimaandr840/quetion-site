import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CookieSettingsButton } from "@/components/layout/CookieSettingsButton";
import { buildMetadata } from "@/lib/seo";
import styles from "../legal.module.css";

/**
 * Политика использования cookie.
 *
 * § 25 TDDDG (ЕС/Германия) требует согласия на любой доступ к данным в
 * устройстве, кроме строго необходимого для работы сервиса. Поэтому таблица
 * ниже разделена на «необходимые» и «по согласию», а аналитика не грузится
 * до нажатия «Принять все» — см. components/analytics/GoogleAnalytics.tsx.
 */

const UPDATED_AT = "2 сентября 2026 г.";

export const metadata: Metadata = buildMetadata({
  title: "Использование cookie",
  description:
    "Какие cookie ставит сайт, какие из них требуют согласия и как отозвать согласие на аналитику.",
  path: "/legal/cookies",
});

export default function CookiePolicyPage() {
  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs
        items={[{ label: "Главная", href: "/" }, { label: "Cookie" }]}
      />

      <header className={styles.head}>
        <h1 className="h1">Использование cookie</h1>
        <p className={styles.updated}>Редакция от {UPDATED_AT}</p>
      </header>

      <p className={styles.notice}>
        Шаблон. Перед публикацией сверьте состав таблицы с тем, что реально
        ставится на сайте, и заполните значения в квадратных скобках.
      </p>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>1. Что такое cookie</h2>
        <p className={styles.paragraph}>
          Cookie — небольшие файлы, которые сайт сохраняет в браузере. Мы также
          используем localStorage: юридически это то же самое — доступ к данным
          в вашем устройстве.
        </p>
        <p className={styles.paragraph}>
          Технически необходимые cookie ставятся без согласия: без них сайт не
          работает (§ 25(2) TDDDG). Всё остальное — только после вашего
          явного согласия.
        </p>
      </section>

      <section className={styles.section} id="necessary">
        <h2 className={`h3 ${styles.heading}`}>2. Необходимые</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Название</th>
              <th>Назначение</th>
              <th>Кто ставит</th>
              <th>Срок</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>dp_session</td>
              <td>Признак активной сессии администратора</td>
              <td>Сайт</td>
              <td>До конца сессии</td>
            </tr>
            <tr>
              <td>Сессионный токен (httpOnly)</td>
              <td>Аутентификация в админ-панели</td>
              <td>Сайт</td>
              <td>До конца сессии</td>
            </tr>
            <tr>
              <td>dp_cookie_consent</td>
              <td>Хранит ваше решение по cookie и его дату</td>
              <td>Сайт</td>
              <td>12 месяцев</td>
            </tr>
            <tr>
              <td>devprep-theme (localStorage)</td>
              <td>Запоминает светлую или тёмную тему</td>
              <td>Сайт</td>
              <td>До очистки браузера</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section} id="analytics">
        <h2 className={`h3 ${styles.heading}`}>3. Аналитические (по согласию)</h2>
        <p className={styles.paragraph}>
          Мы используем Google Analytics 4 (Google Ireland Limited), чтобы
          понимать, какие материалы читают. Скрипт загружается только после
          нажатия «Принять все»: до этого запросов к Google нет. Реклама и
          ремаркетинг отключены, IP-адрес усечён (anonymize_ip).
        </p>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Название</th>
              <th>Назначение</th>
              <th>Кто ставит</th>
              <th>Срок</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>_ga</td>
              <td>Различает посетителей (псевдонимный идентификатор)</td>
              <td>Google</td>
              <td>2 года</td>
            </tr>
            <tr>
              <td>_ga_[идентификатор свойства]</td>
              <td>Хранит состояние сессии GA4</td>
              <td>Google</td>
              <td>2 года</td>
            </tr>
          </tbody>
        </table>

        <p className={styles.paragraph}>
          Данные могут обрабатываться в США — об основаниях передачи см. раздел 5{" "}
          <Link href="/legal/privacy" className={styles.link}>
            политики конфиденциальности
          </Link>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>4. Как изменить решение</h2>
        <p className={styles.paragraph}>
          Отозвать или дать согласие можно в любой момент:{" "}
          <CookieSettingsButton className={styles.settingsButton} />. При отзыве
          аналитика отключается сразу, а cookie Google удаляются.
        </p>
        <p className={styles.paragraph}>
          Cookie также можно удалить или заблокировать средствами браузера. Если
          заблокировать необходимые cookie, вход в админ-панель и запоминание
          темы работать не будут.
        </p>
      </section>
    </div>
  );
}
