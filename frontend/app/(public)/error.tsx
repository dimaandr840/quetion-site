"use client";

import { Button } from "@/components/ui/Button";
import styles from "@/styles/status.module.css";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={`shell ${styles.wrap}`}>
      <p className={styles.code}>500</p>
      <span className={styles.divider} aria-hidden="true" />
      <h1 className={`h2 ${styles.title}`}>Что-то пошло не так</h1>
      <p className={`body-base ${styles.text}`}>
        Произошла внутренняя ошибка сервера. Мы уже работаем над её устранением.
      </p>
      <div className={styles.actions}>
        <Button type="button" onClick={reset} size="small">
          Повторить попытку
        </Button>
      </div>
    </div>
  );
}
