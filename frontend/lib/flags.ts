/**
 * Флаг авторизации. Включён: /admin закрыт proxy-редиректом на /login, в шапке
 * админки видна кнопка «Выйти».
 *
 * Значение подставляется на этапе сборки (build arg NEXT_PUBLIC_AUTH_ENABLED в
 * frontend/Dockerfile), поэтому его изменение требует пересборки образа web.
 * Единый переключатель для фронта и бэкенда — AUTH_ENABLED в .env.
 */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
