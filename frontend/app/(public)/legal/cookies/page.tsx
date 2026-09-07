import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import styles from "../legal.module.css";

const UPDATED_AT = "7 сентября 2026 г.";
export const metadata: Metadata = buildMetadata({
  title: "Использование cookie",
  description: "Какие технические cookie и локальные настройки использует Qareer Quest.",
  path: "/legal/cookies",
});

export default function CookiePolicyPage() {
  return (
    <div className={`shell ${styles.wrap}`}>
      <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Cookie" }]} />
      <header className={styles.head}><h1 className="h1">Использование cookie</h1><p className={styles.updated}>Редакция от {UPDATED_AT}</p></header>
      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>1. Общие сведения</h2>
        <p className={styles.paragraph}>Сайт не использует рекламные или аналитические cookie и не загружает Google Analytics. Используются только данные браузера, необходимые для безопасности, входа администратора и сохранения выбранной темы.</p>
      </section>
      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>2. Используемые данные браузера</h2>
        <table className={styles.table}><thead><tr><th>Название</th><th>Назначение</th><th>Срок</th></tr></thead><tbody>
          <tr><td>dp_session</td><td>Технический признак сессии администратора; не является токеном доступа</td><td>До конца сессии</td></tr>
          <tr><td>HttpOnly-токены</td><td>Аутентификация и обновление сессии администратора</td><td>По сроку соответствующего токена</td></tr>
          <tr><td>devprep-theme (localStorage)</td><td>Сохранение светлой или тёмной темы</td><td>До удаления пользователем</td></tr>
          <tr><td>devprep-progress (localStorage)</td><td>Локальное сохранение прогресса чтения; не отправляется на сервер</td><td>До удаления пользователем</td></tr>
        </tbody></table>
      </section>
      <section className={styles.section}>
        <h2 className={`h3 ${styles.heading}`}>3. Управление</h2>
        <p className={styles.paragraph}>Данные можно удалить в настройках браузера. После блокировки необходимых cookie вход в админ-панель работать не будет; публичные материалы останутся доступны.</p>
      </section>
    </div>
  );
}
