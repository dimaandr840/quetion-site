"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api";
import {
  buildQuestionPayload,
  createQuestion,
  sectionsToHtml,
  updateQuestion,
  type AdminQuestionDetailDto,
  type QuestionImagePayload,
} from "@/lib/admin-api";
import { normalizeLinkHref } from "@/lib/inline-html";
import { LEVELS } from "@/lib/queries";
import type { Level } from "@/lib/types";
import QuestionImagesField from "./QuestionImagesField";
import styles from "./QuestionFormModal.module.css";

export interface QuestionFormOption {
  slug: string;
  title: string;
}

interface QuestionFormModalProps {
  professions: QuestionFormOption[];
  categories: (QuestionFormOption & { professionSlug: string })[];
  /** Заполненный вопрос переводит окно в режим редактирования. */
  initial?: AdminQuestionDetailDto | null;
  onClose: () => void;
  onSaved?: () => void;
}

type ToolbarCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "formatBlock:h1"
  | "formatBlock:h2"
  | "formatBlock:pre"
  | "formatBlock:blockquote";

/** Действия, которых нет в document.execCommand — обрабатываются вручную. */
type ToolbarAction = "inline-code" | "highlight" | "link";

interface ToolbarButton {
  key: string;
  label?: string;
  icon?: IconName;
  title: string;
  command?: ToolbarCommand;
  action?: ToolbarAction;
  mono?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  small?: boolean;
}

/**
 * Панель форматирования. Каждая кнопка обязана что-то делать: набор ограничен
 * тем, что умеет сохранить parseAnswerHtml и показать публичная страница вопроса.
 * Картинок и таблиц здесь нет: таблицы некуда сохранить, а картинки живут не в
 * разметке ответа, а отдельным списком внизу формы — так у них есть alt,
 * подпись и порядок, а бэкенд может чистить файлы при отвязке.
 */
const TOOLBAR_GROUPS: ToolbarButton[][] = [
  [
    { key: "bold", label: "B", title: "Полужирный", command: "bold" },
    { key: "italic", label: "I", title: "Курсив", command: "italic", italic: true },
    { key: "underline", label: "U", title: "Подчёркнутый", command: "underline", underline: true },
    { key: "strike", label: "S", title: "Зачёркнутый", command: "strikeThrough", strike: true },
  ],
  [
    { key: "h1", label: "H1", title: "Заголовок 1", command: "formatBlock:h1", small: true },
    { key: "h2", label: "H2", title: "Заголовок 2", command: "formatBlock:h2", small: true },
    { key: "ul", icon: "list", title: "Список", command: "insertUnorderedList" },
    { key: "ol", icon: "list-ordered", title: "Нумерованный список", command: "insertOrderedList" },
  ],
  [
    {
      key: "inline-code",
      label: "<>",
      title: "Строчный код",
      action: "inline-code",
      mono: true,
      small: true,
    },
    { key: "code-block", icon: "code", title: "Блок кода", command: "formatBlock:pre" },
  ],
  [
    { key: "link", icon: "link", title: "Ссылка", action: "link" },
    { key: "highlight", icon: "highlighter", title: "Выделение", action: "highlight" },
    { key: "quote", icon: "quote", title: "Цитата", command: "formatBlock:blockquote" },
  ],
];

/** Ближайший предок с нужным тегом внутри редактора — чтобы снимать форматирование повторным нажатием. */
function closestTag(node: Node | null, tag: string, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).tagName.toLowerCase() === tag
    ) {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }
  return null;
}

/** Разворачивает элемент, оставляя его содержимое на месте. */
function unwrap(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export function QuestionFormModal({
  professions,
  categories,
  initial,
  onClose,
  onSaved,
}: QuestionFormModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const overlayMouseDown = useRef(false);
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [professionSlug, setProfessionSlug] = useState(
    initial?.professionSlug ?? professions[0]?.slug ?? ""
  );
  const [level, setLevel] = useState<Level>(initial?.level ?? "Middle");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [images, setImages] = useState<QuestionImagePayload[]>(initial?.images ?? []);
  const [publish, setPublish] = useState(initial ? initial.published !== false : true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.professionSlug === professionSlug),
    [categories, professionSlug]
  );
  const [categorySlug, setCategorySlug] = useState(
    initial?.categorySlug ?? visibleCategories[0]?.slug ?? ""
  );

  // HTML исходного ответа считаем один раз: он же служит эталоном для проверки изменений.
  const initialHtmlRef = useRef(initial ? sectionsToHtml(initial.sections ?? []) : "");
  // Слепок картинок для той же проверки: сравниваем ключи и подписи, а не
  // ссылки на объекты — иначе любой рендер считался бы правкой.
  const initialImagesRef = useRef(
    JSON.stringify(
      (initial?.images ?? []).map((image) => [
        image.storageKey,
        image.alt,
        image.caption ?? "",
      ])
    )
  );

  // При смене направления ранее выбранная категория может стать
  // недоступной — подставляем первую доступную во время рендера,
  // без синхронизации состояния в useEffect.
  const effectiveCategorySlug = visibleCategories.some(
    (category) => category.slug === categorySlug
  )
    ? categorySlug
    : visibleCategories[0]?.slug ?? "";

  /**
   * Закрытие с защитой от потери введённого текста: раньше клик по фону
   * уничтожал заполненную форму без предупреждения. В режиме редактирования
   * сравниваем с исходными значениями, иначе предупреждение срабатывало бы всегда.
   */
  function requestClose() {
    const editorText = (editorRef.current?.textContent ?? "").trim();
    const imagesSnapshot = JSON.stringify(
      images.map((image) => [image.storageKey, image.alt, image.caption ?? ""])
    );
    const dirty = initial
      ? title.trim() !== (initial.title ?? "").trim() ||
        tags.trim() !== (initial.tags ?? []).join(", ").trim() ||
        editorRef.current?.innerHTML !== initialHtmlRef.current ||
        level !== initial.level ||
        professionSlug !== initial.professionSlug ||
        effectiveCategorySlug !== initial.categorySlug ||
        imagesSnapshot !== initialImagesRef.current ||
        publish !== (initial.published !== false)
      : title.trim().length > 0 ||
        tags.trim().length > 0 ||
        images.length > 0 ||
        editorText.length > 0;

    if (dirty && !window.confirm("Закрыть окно? Изменения не сохранятся.")) return;
    onClose();
  }

  // Обработчик Escape живёт в effect'е с пустыми зависимостями, поэтому берёт
  // актуальную функцию через ref, а не замыкает первую версию.
  // Ref обновляем в effect'е: запись во время рендера запрещена правилами React.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Режим редактирования: разметка собирается из секций и проходит санитайзер.
    if (editorRef.current && initialHtmlRef.current) {
      editorRef.current.innerHTML = initialHtmlRef.current;
    }
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, []);

  function runCommand(command?: ToolbarCommand) {
    if (!command) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    if (command.startsWith("formatBlock:")) {
      const tag = command.split(":")[1];
      const selection = window.getSelection();
      const anchor = selection?.rangeCount
        ? selection.getRangeAt(0).startContainer
        : null;
      // Повторное нажатие снимает блочный формат: иначе из цитаты или блока
      // кода нельзя было вернуться к обычному абзацу.
      const active = closestTag(anchor, tag, editor);
      document.execCommand("formatBlock", false, active ? "p" : tag);
      return;
    }
    document.execCommand(command);
  }

  /**
   * Enter на пустой строке выводит курсор из цитаты или блока кода в обычный
   * абзац. Обычный Enter остаётся за браузером: он сам знает, как переносить
   * строку внутри блока. Без этого форматирование тянулось до конца ответа.
   */
  function onEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!editor || !selection || !range || !range.collapsed) return;

    const block =
      closestTag(range.startContainer, "pre", editor) ??
      closestTag(range.startContainer, "blockquote", editor);
    if (!block) return;

    // Пустая последняя строка — единственный признак, по которому автор
    // сообщает, что блок закончен. Range.toString() не видит <br>, поэтому
    // содержимое до курсора берём фрагментом и переводим <br> в \n.
    const upToCaret = range.cloneRange();
    upToCaret.selectNodeContents(block);
    upToCaret.setEnd(range.startContainer, range.startOffset);
    const before = document.createElement("div");
    before.appendChild(upToCaret.cloneContents());
    for (const br of Array.from(before.querySelectorAll("br"))) {
      br.replaceWith(document.createTextNode("\n"));
    }
    const currentLine = (before.textContent ?? "").split("\n").pop() ?? "";

    const afterCaret = range.cloneRange();
    afterCaret.selectNodeContents(block);
    afterCaret.setStart(range.endContainer, range.endOffset);
    const rest = document.createElement("div");
    rest.appendChild(afterCaret.cloneContents());

    if (currentLine.trim() !== "" || (rest.textContent ?? "").trim() !== "") return;

    event.preventDefault();

    while (block.lastChild?.nodeName === "BR") block.removeChild(block.lastChild);

    const paragraph = document.createElement("p");
    paragraph.appendChild(document.createElement("br"));
    block.parentNode?.insertBefore(paragraph, block.nextSibling);
    if (!(block.textContent ?? "").trim()) block.remove();

    const next = document.createRange();
    next.setStart(paragraph, 0);
    next.collapse(true);
    selection.removeAllRanges();
    selection.addRange(next);
  }

  /**
   * Оборачивает выделение в тег (code/mark) либо снимает обёртку, если она уже есть.
   * document.execCommand не умеет ни того, ни другого, поэтому работаем с Range.
   */
  function toggleInlineTag(tag: "code" | "mark") {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!selection || !range || !editor.contains(range.commonAncestorContainer)) return;

    const existing =
      closestTag(range.startContainer, tag, editor) ??
      closestTag(range.endContainer, tag, editor);

    if (existing) {
      unwrap(existing);
      editor.normalize();
      return;
    }

    if (range.collapsed) return; // без выделения оборачивать нечего

    const wrapper = document.createElement(tag);
    try {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    } catch {
      // Выделение пересекает границы блоков — surroundContents/insertNode невозможны.
      return;
    }

    const next = document.createRange();
    next.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(next);
  }

  /** Ссылка: спрашиваем адрес и пропускаем только http(s), mailto и внутренние пути. */
  function insertLink() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!selection || !range || !editor.contains(range.commonAncestorContainer)) return;

    const existing =
      closestTag(range.startContainer, "a", editor) ??
      closestTag(range.endContainer, "a", editor);

    if (existing && range.collapsed) {
      unwrap(existing);
      editor.normalize();
      return;
    }

    if (range.collapsed) {
      setError("Выделите текст, который станет ссылкой.");
      return;
    }

    const saved = range.cloneRange();
    const entered = window.prompt("Адрес ссылки (https://... или /questions/...)", "https://");
    if (entered === null) return;

    const href = normalizeLinkHref(entered);
    if (!href) {
      setError("Недопустимый адрес ссылки. Разрешены http(s), mailto и внутренние пути.");
      return;
    }

    setError(null);
    selection.removeAllRanges();
    selection.addRange(saved);
    document.execCommand("createLink", false, href);
  }

  function onToolbarClick(button: ToolbarButton) {
    if (button.action === "link") {
      insertLink();
      return;
    }
    if (button.action === "inline-code") {
      toggleInlineTag("code");
      return;
    }
    if (button.action === "highlight") {
      toggleInlineTag("mark");
      return;
    }
    runCommand(button.command);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const answerHtml = editorRef.current?.innerHTML ?? "";
    if (!(editorRef.current?.textContent ?? "").trim()) {
      setError("Заполните текст ответа.");
      return;
    }
    if (!professionSlug || !effectiveCategorySlug) {
      setError("Выберите направление и категорию.");
      return;
    }
    // alt обязателен и на бэкенде (@NotBlank). Проверяем здесь, чтобы админ
    // видел понятный текст вместо общей ошибки валидации 400.
    if (images.some((image) => !image.alt.trim())) {
      setError("У каждой картинки заполните альтернативный текст.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const payload = buildQuestionPayload({
        title,
        level,
        professionSlug,
        categorySlug: effectiveCategorySlug,
        tags,
        answerHtml,
        published: publish,
        images,
        slug: initial?.slug,
      });

      if (initial) {
        await updateQuestion(initial.slug, payload);
      } else {
        await createQuestion(payload);
      }
      onSaved?.();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail ?? caught.message
          : "Не удалось сохранить вопрос. Проверьте соединение."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      // Закрываем по полному клику, который и начался, и закончился на фоне:
      // на mousedown окно закрывалось даже при выделении текста мышью,
      // а завершение выделения за пределами окна больше не считается кликом по фону.
      onMouseDown={(event) => {
        overlayMouseDown.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (!overlayMouseDown.current || event.target !== event.currentTarget) return;
        overlayMouseDown.current = false;
        requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-question-modal-title"
      >
        <div className={styles.header}>
          <h2 className={styles.title} id="admin-question-modal-title">
            {isEdit ? "Редактирование вопроса" : "Новый вопрос для собеседования"}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={requestClose}
            aria-label="Закрыть окно"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.body}>
            <div className={styles.group}>
              <label className={styles.label} htmlFor="admin-question-title">
                Текст вопроса *
              </label>
              <input
                id="admin-question-title"
                className={styles.input}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Введите формулировку вопроса, как на собеседовании..."
                required
              />
            </div>

            <div className={styles.row}>
              <div className={styles.group}>
                <label className={styles.label} htmlFor="admin-question-profession">
                  Направление (Профессия)
                </label>
                <div className={styles.selectWrap}>
                  <select
                    id="admin-question-profession"
                    className={styles.select}
                    value={professionSlug}
                    onChange={(event) => setProfessionSlug(event.target.value)}
                  >
                    {professions.map((profession) => (
                      <option key={profession.slug} value={profession.slug}>
                        {profession.title}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={16} className={styles.selectIcon} />
                </div>
              </div>

              <div className={styles.group}>
                <label className={styles.label} htmlFor="admin-question-category">
                  Категория базы знаний
                </label>
                <div className={styles.selectWrap}>
                  <select
                    id="admin-question-category"
                    className={styles.select}
                    value={effectiveCategorySlug}
                    onChange={(event) => setCategorySlug(event.target.value)}
                  >
                    {visibleCategories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={16} className={styles.selectIcon} />
                </div>
              </div>
            </div>

            <fieldset className={styles.group}>
              <legend className={styles.label}>Уровень сложности вопроса</legend>
              <div className={styles.levels}>
                {LEVELS.map((item) => (
                  <label
                    key={item}
                    className={`${styles.levelChip} ${
                      level === item ? styles.levelChipActive : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin-question-level"
                      value={item}
                      checked={level === item}
                      onChange={() => setLevel(item)}
                      className={styles.levelInput}
                    />
                    <span className={styles.levelDot} aria-hidden="true" />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.group}>
              <span className={styles.label} id="admin-question-answer-label">
                Развёрнутый ответ *
              </span>
              <div className={styles.editor}>
                <div className={styles.toolbar} role="toolbar" aria-label="Форматирование ответа">
                  {TOOLBAR_GROUPS.map((group, groupIndex) => (
                    <div className={styles.toolbarGroup} key={group[0].key}>
                      {groupIndex > 0 && (
                        <span className={styles.toolbarDivider} aria-hidden="true" />
                      )}
                      {group.map((button) => (
                        <button
                          key={button.key}
                          type="button"
                          className={styles.toolbarButton}
                          title={button.title}
                          aria-label={button.title}
                          onClick={() => onToolbarClick(button)}
                        >
                          {button.icon ? (
                            <Icon name={button.icon} size={16} />
                          ) : (
                            <span
                              className={[
                                styles.toolbarLabel,
                                button.mono ? styles.toolbarMono : "",
                                button.italic ? styles.toolbarItalic : "",
                                button.underline ? styles.toolbarUnderline : "",
                                button.strike ? styles.toolbarStrike : "",
                                button.small ? styles.toolbarSmall : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {button.label}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div
                  ref={editorRef}
                  className={styles.editorContent}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-labelledby="admin-question-answer-label"
                  onKeyDown={onEditorKeyDown}
                  data-placeholder="Опишите ответ: теория, примеры кода, подводные камни..."
                />
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="admin-question-tags">
                Добавить теги (через запятую)
              </label>
              <input
                id="admin-question-tags"
                className={styles.input}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Например: HashMap, Garbage Collector, Memory..."
              />
            </div>

            <div className={styles.group}>
              <span className={styles.label}>Картинки к вопросу</span>
              <QuestionImagesField
                images={images}
                onChange={setImages}
                disabled={pending}
              />
            </div>

            <div className={styles.toggleRow}>
              <span className={styles.toggleTexts}>
                <span className={styles.toggleTitle}>Опубликовать сразу в базу</span>
                <span className={styles.toggleHint}>
                  Если отключено, вопрос будет сохранен как черновик.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={publish}
                aria-label="Опубликовать сразу в базу"
                className={`${styles.switch} ${publish ? styles.switchOn : ""}`}
                onClick={() => setPublish((value) => !value)}
              >
                <span className={styles.switchKnob} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className={styles.footer}>
            {error && (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className={styles.cancel}
              onClick={requestClose}
              disabled={pending}
            >
              Отмена
            </button>
            <button type="submit" className={styles.save} disabled={pending}>
              {pending ? "Сохраняем..." : isEdit ? "Сохранить изменения" : "Сохранить вопрос"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
