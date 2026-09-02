import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CookieSettingsButton } from "@/components/layout/CookieSettingsButton";
import { SITE_CONTACT_EMAIL, SITE_DOMAIN, SITE_NAME } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import styles from "../legal.module.css";

/**
 * Политика конфиденциальности по GDPR (Регламент ЕС 2016/679).
 *
 * Почему именно GDPR, а не 152-ФЗ: сайт размещён на VPS в Германии и открыт
 * для посетителей из ЕС, поэтому обработка попадает под ст. 3 GDPR, а доступ
 * к cookie — под § 25 TDDDG (немецкая имплементация ePrivacy). Прежняя версия
 * страницы была написана под 152-ФЗ и утверждала, что данные хранятся в РФ:
 * для текущей инфраструктуры это неверно.
 *
 * Impressum (§ 5 DDG) обязателен для тех, кто ведёт деятельность из Германии.
 * Пока проект некоммерческий и оператор не зарегистрирован в ЕС, отдельной
 * страницы Impressum нет — но контактный адрес по ст. 13 GDPR обязателен всё
 * равно, поэтому он указан ниже.
 *
 * Шаблон: перед публикацией заменить плейсхолдеры в [квадратных скобках].
 */

const UPDATED_AT = "2 сентября 2026 г.";

export const metadata: Metadata = buildMetadata({
  title: "Политика конфиденциальности",
  description:
    "Кто обрабатывает данные посетителей сайта, на каком основании, кому они передаются и какие права есть у пользователя по GDPR.",
  path: "/legal/privacy",
});

export default function PrivacyPolicyPage() {
  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Политика конфиденциальности" },
        ]}
      />

      <header className={styles.head}>
        <h1 className="h1">Политика конфиденциальности</h1>
        <p className={styles.updated}>Редакция от {UPDATED_AT}</p>
      </header>

      <p className={styles.notice}>
        Шаблон. Перед публикацией замените значения в квадратных скобках на
        реальные данные оператора и проверьте текст с юристом: состав
        обязательных сведений задан ст. 13 GDPR. Этот блок после заполнения
        нужно удалить.
      </p>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>1. Кто обрабатывает данные</h2>
        <p className={styles.paragraph}>
          Контролёр данных (controller, ст. 4(7) GDPR) сайта {SITE_NAME}{" "}
          ({SITE_DOMAIN}): [имя и фамилия или наименование],
          [адрес для корреспонденции], электронная почта:{" "}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className={styles.link}>
            {SITE_CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className={styles.paragraph}>
          Проект некоммерческий, штатного специалиста по защите данных (DPO)
          нет: условия ст. 37 GDPR для обязательного назначения не выполняются.
          Все обращения по персональным данным идут на адрес выше.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>2. Какие данные обрабатываются</h2>
        <ul className={styles.list}>
          <li>
            Технические данные запроса: IP-адрес, User-Agent, дата и время,
            запрошенный адрес, код ответа (журналы веб-сервера и обратного
            прокси).
          </li>
          <li>
            Данные учётной записи администратора: адрес электронной почты,
            отображаемое имя, хеш пароля, настройки двухфакторной
            аутентификации. Публичная часть сайта доступна без регистрации.
          </li>
          <li>
            Cookie и localStorage — полный состав приведён в{" "}
            <Link href="/legal/cookies" className={styles.link}>
              политике использования cookie
            </Link>
            .
          </li>
          <li>
            Данные аналитики Google Analytics 4 — только если вы дали согласие:
            псевдонимизированный идентификатор устройства, просмотренные
            страницы, приблизительное местоположение по IP, характеристики
            браузера.
          </li>
        </ul>
        <p className={styles.paragraph}>
          Особые категории данных (ст. 9 GDPR) не собираются. Автоматизированного
          принятия решений и профилирования по ст. 22 GDPR нет.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>3. Цели и правовые основания</h2>
        <ul className={styles.list}>
          <li>
            Показ страниц и работа сайта — законный интерес в технически
            корректной работе сервиса, ст. 6(1)(f) GDPR.
          </li>
          <li>
            Защита от атак, перебора паролей и злоупотреблений, хранение
            журналов — законный интерес, ст. 6(1)(f) GDPR.
          </li>
          <li>
            Вход администратора и удержание сессии — исполнение договора и
            законный интерес, ст. 6(1)(b) и 6(1)(f) GDPR.
          </li>
          <li>
            Аналитика посещаемости (Google Analytics 4) — исключительно ваше
            согласие, ст. 6(1)(a) GDPR и § 25(1) TDDDG. Отказ ни на что не
            влияет: сайт работает полностью.
          </li>
          <li>
            Ответ на ваше письмо — законный интерес в обработке обращения,
            ст. 6(1)(f) GDPR.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>4. Кому передаются данные</h2>
        <p className={styles.paragraph}>
          Данные не продаются и не передаются для чужого маркетинга. Обработчики
          (processors, ст. 28 GDPR), задействованные в работе сайта:
        </p>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Получатель</th>
              <th>Роль</th>
              <th>Расположение</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Spaceship (VPS-хостинг)</td>
              <td>Размещение приложения и базы данных</td>
              <td>Дата-центр в Германии, ЕС</td>
            </tr>
            <tr>
              <td>Spaceship (регистратор домена)</td>
              <td>Регистрация домена {SITE_DOMAIN}</td>
              <td>[страна по договору с регистратором]</td>
            </tr>
            <tr>
              <td>Google Ireland Limited / Google LLC</td>
              <td>Google Analytics 4 — только по согласию</td>
              <td>ЕС и США</td>
            </tr>
            <tr>
              <td>[SMTP-провайдер, если подключён]</td>
              <td>Отправка писем восстановления пароля</td>
              <td>[страна]</td>
            </tr>
          </tbody>
        </table>

        <p className={styles.paragraph}>
          Госорганам данные раскрываются только по обязательному требованию
          применимого права.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>5. Передача за пределы ЕЭЗ</h2>
        <p className={styles.paragraph}>
          Сайт и база данных размещены в Германии, то есть в пределах ЕЭЗ. При
          использовании Google Analytics данные могут обрабатываться в США:
          передача основана на решении о достаточности EU–US Data Privacy
          Framework и стандартных договорных условиях Google (ст. 45 и 46 GDPR).
          Если вы не давали согласия на аналитику, такой передачи не происходит.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>6. Сроки хранения</h2>
        <ul className={styles.list}>
          <li>Журналы веб-сервера и прокси — [срок, обычно 7–30 дней].</li>
          <li>Данные учётной записи — пока учётная запись существует.</li>
          <li>Cookie — сроки указаны в политике использования cookie.</li>
          <li>Данные Google Analytics — [срок хранения, заданный в свойстве GA4].</li>
          <li>Переписка по обращениям — [срок].</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>7. Ваши права</h2>
        <p className={styles.paragraph}>
          По GDPR вы вправе требовать доступ к своим данным (ст. 15), их
          исправление (ст. 16), удаление (ст. 17), ограничение обработки
          (ст. 18), переносимость (ст. 20), а также возражать против обработки
          на основании законного интереса (ст. 21).
        </p>
        <p className={styles.paragraph}>
          Согласие на аналитические cookie отзывается в один клик и без
          объяснения причин:{" "}
          <CookieSettingsButton className={styles.settingsButton} />. Отзыв
          не затрагивает законность обработки до момента отзыва
          (ст. 7(3) GDPR).
        </p>
        <p className={styles.paragraph}>
          Запрос направляйте на{" "}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className={styles.link}>
            {SITE_CONTACT_EMAIL}
          </a>
          ; ответ даётся в течение одного месяца (ст. 12(3) GDPR). Вы также
          вправе подать жалобу в надзорный орган по защите данных — по месту
          жительства, работы или предполагаемого нарушения (ст. 77 GDPR). Для
          инфраструктуры в Германии это орган соответствующей федеральной земли.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>8. Безопасность и изменения</h2>
        <p className={styles.paragraph}>
          Применяются меры по ст. 32 GDPR: HTTPS, хранение паролей в виде хешей,
          двухфакторная аутентификация администраторов, ограничение доступа к
          админ-панели, заголовки безопасности и Content-Security-Policy.
        </p>
        <p className={styles.paragraph}>
          Новая редакция публикуется по этому же адресу. Если меняется состав
          cookie или появляются новые получатели данных, согласие запрашивается
          заново.
        </p>
      </section>
    </div>
  );
}
