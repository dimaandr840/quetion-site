import { apiFetch } from "./api";

export type AuthStatus =
  | "AUTHENTICATED"
  | "TOTP_REQUIRED"
  | "TOTP_SETUP_REQUIRED";

export type Role = "ROLE_USER" | "ROLE_ADMIN";

export interface AuthUser {
  email: string;
  displayName: string;
  roles: Role[];
}

export interface TotpSetup {
  secret: string;
  provisioningUri: string;
}

export interface AuthResponse {
  status: AuthStatus;
  expiresIn: number;
  user?: AuthUser;
  totpSetup?: TotpSetup;
}

/**
 * Ответ на запрос восстановления доступа. Адреса получателя здесь нет намеренно:
 * сервер его не отдаёт даже маской, поэтому показать его в интерфейсе нечем.
 */
export interface PasswordResetRequested {
  expiresInMinutes: number;
}

/** Читаемая (не httpOnly) cookie-подсказка о текущей сессии. */
export const SESSION_HINT_COOKIE = "dp_session";

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function verifyTotp(code: string) {
  return apiFetch<AuthResponse>("/auth/totp/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function logout() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function refresh() {
  return apiFetch<AuthResponse>("/auth/refresh", { method: "POST" });
}

export function me() {
  return apiFetch<AuthUser>("/me");
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<void>("/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** Шаг 1 восстановления доступа: заказать код на адрес учётки. */
export function requestPasswordReset(email: string) {
  return apiFetch<PasswordResetRequested>("/auth/password/reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Шаг 2 восстановления доступа: код из письма и новый пароль. Гасит все сессии. */
export function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
) {
  return apiFetch<void>("/auth/password/reset/confirm", {
    method: "POST",
    body: JSON.stringify({ email, code, newPassword }),
  });
}
