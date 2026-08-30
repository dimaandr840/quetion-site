import { sanitizeInlineHtml } from "@/lib/inline-html";

/**
 * Абзац или пункт списка с инлайн-разметкой (курсив, код, ссылка, выделение).
 *
 * Строки приходят из базы знаний, где редактор админки сохраняет ограниченный
 * набор инлайн-тегов. Перед вставкой строка всегда проходит sanitizeInlineHtml,
 * поэтому dangerouslySetInnerHTML здесь безопасен: скрипты, обработчики событий
 * и javascript:-ссылки удаляются.
 */
export function RichText({
  as: Tag = "span",
  html,
  className,
}: {
  as?: "p" | "li" | "span" | "div";
  html: string;
  className?: string;
}) {
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(html) }}
    />
  );
}
