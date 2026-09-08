import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CookieSettingsButton } from "@/components/layout/CookieSettingsButton";
import { buildMetadata } from "@/lib/seo";
import styles from "../legal.module.css";

/**
 * Политика использования cookie под 152-ФЗ.
 *
 * Отдельного «закона о cookie» в РФ нет, но Роскомнадзор исходит из того,
 * что cookie с идентификаторами и IP — персональные данные, если позволяют
 * косвенно идентифицировать посетителя или строить его поведенческий
 * профиль. Отсюда деление таблиц на «необходимые» и «по согласию»: аналитика
 * не грузится до нажатия «Принять все» — см.
 * components/analytics/YandexMetrika.tsx.
 */

const UPDATED_AT = "8 сентября 2026 г.";

export const metadata: Metadata = buildMetadata({
  title: "Использование cookie",
  description:
    "Какие cookie ставит сайт, какие из них требуют согласия и как отозвать согласие на аналитику Яндекс Метрики.",
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
          используем localStorage: с точки зрения приватности это то же самое —
          данные, хранимые в вашем устройстве.
        </p>
        <p className={styles.paragraph}>
          Отдельного закона о cookie в России нет, но если cookie позволяет
          косвенно идентифицировать посетителя или строить профиль его
          поведения, то содержимое такого cookie считается персональными данными
          (ст. 3 152-ФЗ, позиция Роскомнадзора). Поэтому аналитика
          подключается только по вашему согласию (ст. 9 152-ФЗ), а
          технически необходимые cookie ставятся без согласия: без них сайт
          не работает, а основание для них — законные интересы оператора
          (п. 5 ч. 1 ст. 6 152-ФЗ).
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
              <td>Хранит ваше решение по cookie, его дату и версию политики</td>
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
          Мы используем Яндекс Метрику (ООО «ЯНДЕКС», Россия), чтобы понимать,
          какие материалы читают. Скрипт загружается только после нажатия
          «Принять все»: до этого запросов к mc.yandex.ru нет, а значит не
          раскрывается и ваш IP-адрес. Вебвизор отключён намеренно: он записывает
          действия на странице и ввод в поля форм. Рекламные сценарии и передача
          аудиторий в рекламные системы не используются.
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
              <td>_ym_uid</td>
              <td>Анонимный идентификатор браузера — различает посетителей</td>
              <td>Яндекс Метрика</td>
              <td>До 1 года</td>
            </tr>
            <tr>
              <td>_ym_d</td>
              <td>Дата первого визита на сайт</td>
              <td>Яндекс Метрика</td>
              <td>До 1 года</td>
            </tr>
            <tr>
              <td>_ym_isad</td>
              <td>Признак блокировщика рекламы в браузере</td>
              <td>Яндекс Метрика</td>
              <td>До 2 суток</td>
            </tr>
            <tr>
              <td>_ym_visorc</td>
              <td>Служебная cookie сеанса счётчика</td>
              <td>Яндекс Метрика</td>
              <td>30 минут</td>
            </tr>
            <tr>
              <td>yabs-sid</td>
              <td>Идентификатор сессии на стороне Яндекса</td>
              <td>Яндекс Метрика</td>
              <td>До конца сессии</td>
            </tr>
          </tbody>
        </table>

        <p className={styles.paragraph}>
          Серверы Яндекс Метрики находятся в России, поэтому трансграничной
          передачи аналитика не создаёт. О том, где размещены сам сайт и база
          данных, см. раздел 5{" "}
          <Link href="/legal/privacy" className={styles.link}>
            политики обработки персональных данных
          </Link>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>4. Как изменить решение</h2>
        <p className={styles.paragraph}>
          Отозвать или дать согласие можно в любой момент:{" "}
          <CookieSettingsButton className={styles.settingsButton} />. При отзыве
          счётчик отключается, а cookie Яндекс Метрики удаляются.
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
