/**
 * Разрешённая инлайн-разметка внутри абзацев и пунктов списка.
 *
 * Абзацы и пункты хранятся в базе как строки, а публичная страница выводит их
 * через dangerouslySetInnerHTML. Поэтому строка обязательно проходит через
 * sanitizeInlineHtml — и при сохранении из админки, и при рендере. Санитайзер
 * написан без DOM, чтобы работать и в Server Components, и в браузере.
 */

/** Теги, которые сохраняются. Всё остальное разворачивается: тег выкидывается, текст остаётся. */
const ALLOWED_TAGS = new Set(["strong", "em", "u", "s", "code", "mark", "a", "br"]);

/** Теги без содержимого. */
const VOID_TAGS = new Set(["br"]);

/** Приведение устаревших/эквивалентных тегов к каноничным. */
const TAG_ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
  strike: "s",
  del: "s",
  ins: "u",
};

const TAG_PATTERN = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const HREF_PATTERN = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

/**
 * Пропускает только http(s), mailto и внутренние ссылки.
 * Отдельно вырезаются управляющие символы: `java\0script:` тоже должен отсекаться.
 */
export function normalizeLinkHref(raw: string): string | null {
  const value = raw.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!value) return null;

  const scheme = value.toLowerCase();
  if (scheme.startsWith("http://") || scheme.startsWith("https://")) return value;
  if (scheme.startsWith("mailto:")) return value;
  // Внутренние ссылки: /questions/..., #anchor. Протокольно-относительные (//host) — нет.
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;

  return null;
}

function safeHref(raw: string): string | null {
  return normalizeLinkHref(raw);
}

function isExternal(href: string): boolean {
  const scheme = href.toLowerCase();
  return scheme.startsWith("http://") || scheme.startsWith("https://");
}

/** Оставляет в строке только разрешённую инлайн-разметку, всё прочее экранирует или разворачивает. */
export function sanitizeInlineHtml(input: string): string {
  if (!input) return "";

  let output = "";
  const open: string[] = [];
  let lastIndex = 0;

  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_PATTERN.exec(input)) !== null) {
    const [full, closing, rawName, rawAttrs] = match;

    output += escapeText(input.slice(lastIndex, match.index));
    lastIndex = match.index + full.length;

    const name = TAG_ALIASES[rawName.toLowerCase()] ?? rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue; // разворачиваем: содержимое сохраняется, тег нет

    if (VOID_TAGS.has(name)) {
      output += `<${name} />`;
      continue;
    }

    if (closing) {
      const depth = open.lastIndexOf(name);
      if (depth === -1) continue; // закрывающий тег без парного открывающего
      while (open.length > depth) {
        output += `</${open.pop()}>`;
      }
      continue;
    }

    if (name === "a") {
      const href = safeHref(HREF_PATTERN.exec(rawAttrs ?? "")?.slice(2).find(Boolean) ?? "");
      if (!href) continue; // ссылка без безопасного адреса выводится как обычный текст
      output += isExternal(href)
        ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer nofollow">`
        : `<a href="${escapeAttribute(href)}">`;
      open.push(name);
      continue;
    }

    output += `<${name}>`;
    open.push(name);
  }

  output += escapeText(input.slice(lastIndex));
  while (open.length > 0) {
    output += `</${open.pop()}>`;
  }

  return output;
}

/** Текст без разметки — для сниппета, tldr и поискового индекса. */
export function stripInlineHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
