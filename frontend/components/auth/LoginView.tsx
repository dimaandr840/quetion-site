"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import {
  login as loginRequest,
  verifyTotp,
  type AuthResponse,
  type TotpSetup,
} from "@/lib/auth";
import styles from "@/app/login/page.module.css";

type Step = "credentials" | "totp";

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleAuthResponse(response: AuthResponse) {
    if (response.status === "AUTHENTICATED") {
      const isAdmin = response.user?.roles.includes("ROLE_ADMIN") ?? false;
      // Открытый редирект недопустим: принимаем только внутренние пути,
      // и не «//host», который браузер трактует как внешний адрес.
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? (isAdmin ? "/admin" : "/"));
      router.refresh();
      return;
    }

    if (response.status === "TOTP_SETUP_REQUIRED") {
      setSetup(response.totpSetup ?? null);
    } else {
      setSetup(null);
    }
    setStep("totp");
    setCode("");
  }

  /**
   * Серверные сообщения вида «Проверьте поля запроса» ничего не говорят
   * пользователю, поэтому переводим коды ответа в понятный текст.
   */
  function describe(caught: unknown): string {
    if (!(caught instanceof ApiError)) {
      return "Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.";
    }

    if (caught.retryAfterSeconds) {
      const minutes = Math.max(1, Math.ceil(caught.retryAfterSeconds / 60));
      return `Слишком много попыток входа. Повторите примерно через ${minutes} мин.`;
    }

    if (caught.status === 400 || caught.status === 422) {
      return step === "totp"
        ? "Код должен состоять из шести цифр."
        : "Проверьте формат почты и пароля.";
    }

    if (caught.status === 401 || caught.status === 403) {
      return step === "totp"
        ? "Неверный или устаревший код. Запросите новый в приложении."
        : "Неверная почта или пароль.";
    }

    if (caught.status === 429) {
      return "Слишком много попыток входа. Попробуйте позже.";
    }

    if (caught.status >= 500) {
      return "Сервис временно недоступен. Попробуйте войти чуть позже.";
    }

    return "Не удалось выполнить вход. Попробуйте ещё раз.";
  }

  async function onSubmitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      handleAuthResponse(await loginRequest(email.trim(), password));
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  async function onSubmitTotp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      handleAuthResponse(await verifyTotp(code.trim()));
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

        {step === "credentials" ? (
          <>
            <h1 className={styles.title}>Вход</h1>
            <p className={styles.subtitle}>
              Введите почту и пароль. Для администраторов дополнительно
              потребуется код из приложения-аутентификатора.
            </p>

            <form className={styles.form} onSubmit={onSubmitCredentials}>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.group}>
                <label className={styles.label} htmlFor="login-email">
                  Электронная почта
                </label>
                <input
                  id="login-email"
                  className={styles.input}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label} htmlFor="login-password">
                  Пароль
                </label>
                <input
                  id="login-password"
                  className={styles.input}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <button className={styles.submit} type="submit" disabled={pending}>
                {pending ? "Проверяем..." : "Войти"}
              </button>

              <Link href="/login/reset" className={styles.link}>
                Забыли пароль или потеряли телефон?
              </Link>

              <Link href="/" className={styles.link}>
                Вернуться на сайт
              </Link>
            </form>
          </>
        ) : (
          <>
            <h1 className={styles.title}>
              {setup ? "Настройка двухфакторной защиты" : "Код подтверждения"}
            </h1>
            <p className={styles.subtitle}>
              {setup
                ? "Добавьте секрет в Google Authenticator, 1Password или Aegis, затем введите шестизначный код."
                : "Введите шестизначный код из приложения-аутентификатора."}
            </p>

            {setup && (
              <div className={styles.secretBox}>
                <span className={styles.secretLabel}>Секретный ключ</span>
                <span className={styles.secretValue}>{setup.secret}</span>
                <span className={styles.hint}>
                  Ключ показывается один раз. Введённый ниже код подтвердит, что
                  приложение настроено корректно.
                </span>
              </div>
            )}

            <form className={styles.form} onSubmit={onSubmitTotp}>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.group}>
                <label className={styles.label} htmlFor="login-totp">
                  Код из приложения
                </label>
                <input
                  id="login-totp"
                  className={`${styles.input} ${styles.code}`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                />
              </div>

              <button
                className={styles.submit}
                type="submit"
                disabled={pending || code.length !== 6}
              >
                {pending ? "Проверяем..." : "Подтвердить"}
              </button>

              <Link href="/login/reset" className={styles.link}>
                Нет доступа к приложению? Восстановить доступ по почте
              </Link>

              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setStep("credentials");
                  setSetup(null);
                  setError(null);
                  setPassword("");
                }}
              >
                Вернуться к вводу пароля
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
