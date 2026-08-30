import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ButtonLink } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import styles from "@/styles/status.module.css";

/**
 * Корневая 404: срабатывает для путей вне группы (public),
 * поэтому шапку и подвал подключаем здесь явно.
 */
export default function NotFound() {
  return (
    <div className="page">
      <Header />
      <main id="main-content">
        <div className={`shell ${styles.wrap}`}>
          <p className={styles.code}>404</p>
          <h1 className={`h1 ${styles.title}`}>Страница не найдена</h1>
          <p className={`body-base ${styles.text}`}>
            К сожалению, запрашиваемая страница удалена или никогда не существовала.
            Попробуйте воспользоваться поиском или вернитесь на главную.
          </p>

          <div className={styles.search}>
            <SearchBar placeholder="Искать вопросы или темы..." variant="compact" />
          </div>

          <div className={styles.actions}>
            <ButtonLink href="/">На главную</ButtonLink>
            <ButtonLink href="/questions" variant="outline">
              База вопросов
            </ButtonLink>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
