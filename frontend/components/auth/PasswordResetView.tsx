"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/auth";
import styles from "@/app/login/page.module.css";

type Step = "request" | "confirm" | "done";

const MIN_PASSWORD_LENGTH = 10;

/**
 * Восстановление доступа по почте (замена резервных кодов).
 *
 * <p>Экран сознательно не показывает адрес получателя: сервер его не возвращает даже маской,
 * а формулировки подобраны так, чтобы по ответу нельзя было понять, зарегистрирован ли
 * введённый адрес. Поэтому текст после отправки одинаковый в любом случае.
 */
export function PasswordResetView() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function describe(caught: unknown): string {
    if (!(caught instanceof ApiError)) {
      return "Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.";
    }
    if (caught.retryAfterSeconds) {
      const minutes = Math.max(1, Math.ceil(caught.retryAfterSeconds / 60));
      return `Слишком много попыток. Повторите примерно через ${minutes} мин.`;
    }
    if (caught.status === 429) {
      return "Слишком много попыток. Попробуйте позже.";
    }
    if (caught.status === 400 || caught.status === 422) {
      return step === "confirm"
        ? "Проверьте код из письма и длину нового пароля."
        : "Проверьте формат адреса почты.";
    }
    if (caught.status === 401 || caught.status === 403) {
      return "Код неверен или уже истёк. Запросите новый код.";
    }
    if (caught.status >= 500) {
      return "Сервис временно недоступен. Попробуйте чуть позже.";
    }
    return "Не удалось выполнить восстановление. Попробуйте ещё раз.";
  }

  async function onRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await requestPasswordReset(email.trim());
      setExpiresInMinutes(response?.expiresInMinutes ?? null);
      setStep("confirm");
      setCode("");
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  async function onConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Новый пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }
    if (password !== repeat) {
      setError("Пароли не совпадают.");
      return;
    }

    setPending(true);
    try {
      await confirmPasswordReset(email.trim(), code.trim(), password);
      setStep("done");
      setPassword("");
      setRepeat("");
      setCode("");
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            D
          </span>
          <span className={styles.brandName}>DevPrep</span>
        </Link>

        {step === "request" && (
          <>
            <h1 className={styles.title}>Восстановление доступа</h1>
            <p className={styles.subtitle}>
              Укажите адрес почты аккаунта. Если такой аккаунт есть, на его почту
              придёт одноразовый код. Сам адрес мы не показываем и не подсказываем.
            </p>

            <form className={styles.form} onSubmit={onRequest}>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.group}>
                <label className={styles.label} htmlFor="reset-email">
                  Электронная почта
                </label>
                <input
                  id="reset-email"
                  className={styles.input}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <button className={styles.submit} type="submit" disabled={pending}>
                {pending ? "Отправляем..." : "Получить код"}
              </button>

              <Link href="/login" className={styles.link}>
                Вернуться к входу
              </Link>
            </form>
          </>
        )}

        {step === "confirm" && (
          <>
            <h1 className={styles.title}>Новый пароль</h1>
            <p className={styles.subtitle}>
              Если аккаунт существует, письмо с кодом уже отправлено на его почту.
              Проверьте свой почтовый ящик и введите код вида XXXX-XXXX.
              {expiresInMinutes
                ? ` Код действует ${expiresInMinutes} мин. и срабатывает один раз.`
                : " Код одноразовый и действует ограниченное время."}
            </p>

            <form className={styles.form} onSubmit={onConfirm}>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.group}>
                <label className={styles.label} htmlFor="reset-code">
                  Код из письма
                </label>
                <input
                  id="reset-code"
                  className={`${styles.input} ${styles.code}`}
                  autoComplete="one-time-code"
                  maxLength={9}
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9-]/g, "")
                        .slice(0, 9)
                    )
                  }
                  required
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label} htmlFor="reset-password">
                  Новый пароль
                </label>
                <input
                  id="reset-password"
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <span className={styles.hint}>
                  Минимум {MIN_PASSWORD_LENGTH} символов. После сброса все活 сессии
                  завершатся, и понадобится войти заново.
                </span>
              </div>

              <div className={styles.group}>
                <label className={styles.label} htmlFor="reset-password-repeat">
                  Повторите пароль
                </label>
                <input
                  id="reset-password-repeat"
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  required
                />
              </div>

              <button className={styles.submit} type="submit" disabled={pending}>
                {pending ? "Сохраняем..." : "Задать новый пароль"}
              </button>

              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setStep("request");
                  setError(null);
                  setCode("");
                  setPassword("");
                  setRepeat("");
                }}
              >
                Запросить код заново
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <h1 className={styles.title}>Пароль обновлён</h1>
            <p className={styles.subtitle}>
              Все активные сессии отозваны. Войдите с новым паролем — если для
              аккаунта включена двухфакторная защита, приложение-аутентификатор
              потребуется настроить заново.
            </p>
            <Link href="/login" className={styles.submit} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
              Перейти к входу
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
