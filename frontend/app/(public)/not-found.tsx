import { ButtonLink } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import styles from "@/styles/status.module.css";

export default function NotFound() {
  return (
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
        <ButtonLink href="/about" variant="outline">
          Связаться с нами
        </ButtonLink>
      </div>
    </div>
  );
}
