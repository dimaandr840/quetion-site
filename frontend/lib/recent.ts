/**
 * Недавние запросы. Раньше на их месте был статический массив-заглушка в content.ts:
 * теперь список настоящий и живёт в браузере пользователя.
 */

const STORAGE_KEY = "devprep-recent-searches";
const LIMIT = 4;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function rememberSearch(query: string) {
  const value = query.trim();
  if (!value) return;

  const next = [value, ...getRecentSearches().filter((item) => item !== value)].slice(
    0,
    LIMIT
  );

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Приватный режим: история просто не сохранится.
  }
}
