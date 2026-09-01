"use server";

import { revalidateTag } from "next/cache";
import { CONTENT_CACHE_TAG } from "./server-api";

/**
 * Сброс кеша публичного контента.
 *
 * Серверные компоненты читают API через serverFetch с next.revalidate и тегом
 * content, поэтому созданное в админке направление или тема появлялись в списке
 * только через несколько минут: window.location.reload() перерисовывал страницу
 * из того же кеша. Админка вызывает это действие сразу после записи, а затем
 * делает router.refresh().
 *
 * В Next.js 16 у revalidateTag появился обязательный второй аргумент —
 * профиль cacheLife. Профиль "max" сбрасывает записи независимо от их
 * возраста, то есть даёт прежнее поведение «инвалидировать всё сейчас».
 */
export async function revalidateContent(): Promise<void> {
  revalidateTag(CONTENT_CACHE_TAG, "max");
}
