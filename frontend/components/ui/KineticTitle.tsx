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
 *
 * LCP: заголовок героя — это и есть LCP-элемент, а анимация с fill both
 * держит слова прозрачными до своего старта. Поэтому анимируются только
 * первые KINETIC_LIMIT слов; остальные показываются сразу, иначе длинный
 * заголовок отодвигает отрисовку текста на несколько сотен миллисекунд
 * (правило excessive-motion: 1–2 анимированных элемента на экран).
 */
const KINETIC_LIMIT = 6;

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
        const isAnimated = index < KINETIC_LIMIT;

        const classNames = [isAnimated ? "kinetic-word" : "kinetic-word-still"];
        if (isAccent) classNames.push("kinetic-accent");

        return (
          <span
            key={`${word}-${index}`}
            className={classNames.join(" ")}
            style={
              isAnimated
                ? ({ "--word-index": index } as React.CSSProperties)
                : undefined
            }
          >
            {isLast ? word : `${word} `}
          </span>
        );
      })}
    </span>
  );
}
