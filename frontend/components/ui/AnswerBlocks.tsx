import type { AnswerBlock, BlockAlign } from "@/lib/types";
import { RichText } from "./RichText";
import styles from "./AnswerBlocks.module.css";

const ALIGN_CLASS: Record<BlockAlign, string> = {
  LEFT: styles.left,
  CENTER: styles.center,
  RIGHT: styles.right,
};

interface AnswerBlocksProps {
  blocks?: AnswerBlock[];
  /** Класс абзаца со страницы: типографика остаётся там, где была. */
  paragraphClassName?: string;
}

/**
 * Тело секции ответа: абзацы и картинки в том порядке, в котором их расставил автор.
 *
 * Картинки выводятся обычным <img>, а не next/image: адрес хранилища задаётся
 * переменной окружения и меняется между стендами, а remotePatterns в next.config нужно
 * знать на сборке. Оптимизацию делает бэкенд при загрузке: он перекодирует файл.
 */
export function AnswerBlocks({ blocks, paragraphClassName }: AnswerBlocksProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, index) => {
        const alignClass = ALIGN_CLASS[block.align ?? "LEFT"];

        if (block.kind === "IMAGE") {
          // Без url рисовать нечего: адрес собирает бэкенд, и его отсутствие значит,
          // что хранилище не настроено. Ломаная иконка хуже пропуска.
          if (!block.url) return null;

          return (
            <figure key={index} className={`${styles.figure} ${alignClass}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.image}
                src={block.url}
                alt={block.alt ?? ""}
                width={block.width}
                height={block.height}
                loading="lazy"
              />
              {block.caption && (
                <figcaption className={styles.caption}>{block.caption}</figcaption>
              )}
            </figure>
          );
        }

        return (
          <RichText
            key={index}
            as="p"
            className={[paragraphClassName, alignClass].filter(Boolean).join(" ")}
            html={block.text ?? ""}
          />
        );
      })}
    </>
  );
}
