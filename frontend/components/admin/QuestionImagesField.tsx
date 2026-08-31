"use client";

import { useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import type { QuestionImagePayload } from "@/lib/admin-api";
import { deleteMedia, uploadQuestionImage } from "@/lib/media-api";
import styles from "./QuestionImagesField.module.css";

/**
 * Загрузка картинок к вопросу.
 *
 * Файл уезжает в хранилище сразу при выборе, а не при сохранении формы: так
 * ошибка формата или размера видна мгновенно и можно показать превью с
 * реального адреса. Обратная сторона — файл, загруженный перед закрытием окна
 * без сохранения, остаётся сиротой; такие объекты по ночам удаляет
 * MediaMaintenanceJob на бэкенде.
 *
 * accept на input — только подсказка проводнику. Настоящая проверка формата
 * происходит на бэкенде: он декодирует картинку и перекодирует заново,
 * поэтому переименованный в .jpg скрипт или SVG с <script> внутрь не попадут.
 */

const ACCEPT = "image/jpeg,image/png";
const MAX_IMAGES = 8;

interface Props {
  images: QuestionImagePayload[];
  onChange: (images: QuestionImagePayload[]) => void;
  disabled?: boolean;
}

export default function QuestionImagesField({ images, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Ключи, загруженные в этом сеансе: только их безопасно физически удалять
  // по нажатию «Удалить». Картинки уже сохранённого вопроса отвязываются
  // логически, а файл удалит бэкенд при апсерте — иначе отмена правки
  // оставила бы битую ссылку.
  const uploadedNow = useRef<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = disabled || pending;

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Инпут сбрасываем сразу: иначе повторный выбор того же файла не даст события.
    event.target.value = "";
    if (files.length === 0) return;

    const free = MAX_IMAGES - images.length;
    if (free <= 0) {
      setError(`Больше ${MAX_IMAGES} картинок к одному вопросу добавить нельзя`);
      return;
    }

    setPending(true);
    setError(null);

    const added: QuestionImagePayload[] = [];
    try {
      for (const file of files.slice(0, free)) {
        const uploaded = await uploadQuestionImage(file);
        uploadedNow.current.add(uploaded.storageKey);
        added.push({
          storageKey: uploaded.storageKey,
          url: uploaded.url,
          alt: "",
          width: uploaded.width,
          height: uploaded.height,
        });
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Не удалось загрузить файл"
      );
    } finally {
      setPending(false);
      // Уже загруженные до ошибки файлы не выбрасываем: они лежат в хранилище
      // и админ вряд ли хочет повторять загрузку из-за одного плохого файла.
      if (added.length > 0) onChange([...images, ...added]);
    }
  }

  function patch(index: number, changes: Partial<QuestionImagePayload>) {
    onChange(
      images.map((image, position) =>
        position === index ? { ...image, ...changes } : image
      )
    );
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    const image = images[index];
    onChange(images.filter((_, position) => position !== index));

    if (uploadedNow.current.has(image.storageKey)) {
      uploadedNow.current.delete(image.storageKey);
      // Ошибку удаления не показываем: вопрос уже без картинки, а забытый
      // объект подберёт ночная чистка сирот.
      void deleteMedia(image.storageKey).catch(() => undefined);
    }
  }

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <button
          type="button"
          className={styles.add}
          onClick={() => inputRef.current?.click()}
          disabled={busy || images.length >= MAX_IMAGES}
        >
          {pending ? "Загрузка…" : "Добавить картинку"}
        </button>
        <span className={styles.hint}>JPEG или PNG, до 5 МБ</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={onPick}
        />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {images.length > 0 ? (
        <ul className={styles.list}>
          {images.map((image, index) => (
            <li key={image.storageKey} className={styles.item}>
              {/* Обычный img, а не next/image: превью в админке не кэшируется
                  и не нуждается в оптимизации, зато не тянет за собой домен
                  в конфиг сборки для стенда без хранилища. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.preview}
                src={image.url}
                alt={image.alt || "Загруженная картинка"}
              />

              <div className={styles.fields}>
                <label className={styles.label}>
                  Альтернативный текст
                  <input
                    className={styles.input}
                    value={image.alt}
                    maxLength={300}
                    required
                    placeholder="Что видно на картинке"
                    onChange={(event) => patch(index, { alt: event.target.value })}
                    disabled={busy}
                  />
                </label>
                <label className={styles.label}>
                  Подпись (необязательно)
                  <input
                    className={styles.input}
                    value={image.caption ?? ""}
                    maxLength={500}
                    onChange={(event) => patch(index, { caption: event.target.value })}
                    disabled={busy}
                  />
                </label>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => move(index, -1)}
                  disabled={busy || index === 0}
                  aria-label="Выше"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => move(index, 1)}
                  disabled={busy || index === images.length - 1}
                  aria-label="Ниже"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(index)}
                  disabled={busy}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
