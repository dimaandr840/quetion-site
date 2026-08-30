/**
 * KineticTitle — кинетическая типографика без JS в рантайме.
 *
 * Заимствовано из taste-skill: заголовок собирается по словам, а акцент
 * ставится маркером в том же семействе шрифта (EMPHASIS RULE), а не
 * вставкой serif-слова и не градиентным текстом.
 *
 * Доступность: текст остаётся цельным для скринридеров — слова разделены
 * пробелами внутри span, ничего не скрыто и не дублируется.
 * При prefers-reduced-motion анимация выключается (см. motion.css).
 */
export function KineticTitle({
  text,
  accent,
  className,
}: {
  text: string;
  /** Слово или фраза внутри text, которая получает акцентный маркер. */
  accent?: string;
  className?: string;
}) {
  const words = text.split(" ");
  const accentWords = accent ? accent.split(" ") : [];
  const accentStart = accent
    ? words.findIndex((_, index) =>
        accentWords.every((word, offset) => words[index + offset] === word),
      )
    : -1;

  return (
    <span className={className ? `kinetic ${className}` : "kinetic"}>
      {words.map((word, index) => {
        const isAccent =
          accentStart >= 0 &&
          index >= accentStart &&
          index < accentStart + accentWords.length;
        const isLast = index === words.length - 1;

        return (
          <span
            key={`${word}-${index}`}
            className={
              isAccent ? "kinetic-word kinetic-accent" : "kinetic-word"
            }
            style={{ "--word-index": index } as React.CSSProperties}
          >
            {isLast ? word : `${word} `}
          </span>
        );
      })}
    </span>
  );
}
