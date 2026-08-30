import type { Level, SortOption } from "./types";

/**
 * Состояние списка вопросов живёт в URL, а не в React.
 * Фильтр, сортировка, чипсы и пагинация собирают ссылки одной и той же
 * функцией — иначе один и тот же результат имел бы разные адреса.
 */
export interface ListQueryState {
  query?: string;
  levels?: Level[];
  professions?: string[];
  onlyPopular?: boolean;
  sort?: SortOption;
  /** Страница добавляется явно — любое изменение фильтра её сбрасывает. */
  page?: number;
}

export function buildListHref(basePath: string, state: ListQueryState): string {
  const search = new URLSearchParams();

  if (state.query) search.set("q", state.query);
  for (const level of state.levels ?? []) search.append("level", level);
  for (const slug of state.professions ?? []) search.append("profession", slug);
  if (state.onlyPopular) search.set("only", "popular");
  // popular — дефолт, в URL его не пишем: canonical остаётся чистым.
  if (state.sort && state.sort !== "popular") search.set("sort", state.sort);
  if (state.page && state.page > 1) search.set("page", String(state.page));

  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
