"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api";
import {
  buildQuestionPayload,
  createQuestion,
  imageToHtml,
  sectionsToHtml,
  updateQuestion,
  type AdminQuestionDetailDto,
} from "@/lib/admin-api";
import { normalizeLinkHref } from "@/lib/inline-html";
import { uploadQuestionImage } from "@/lib/media-api";
import { LEVELS } from "@/lib/queries";
import type { BlockAlign, Level } from "@/lib/types";
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
type ToolbarAction =
  | "inline-code"
  | "highlight"
  | "link"
  | "image"
  | "align-left"
  | "align-center"
  | "align-right";

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
 * Таблиц здесь нет: их некуда сохранить в модели ответа.
 *
 * Выравнивание и картинка подписаны буквами, а не иконками: в наборе Icon нет
 * подходящих глифов, а выдумывать имя иконки нельзя — тип IconName закрытый.
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
      key: "align-left",
      label: "≡L",
      title: "По левому краю",
      action: "align-left",
      small: true,
    },
    {
      key: "align-center",
      label: "≡C",
      title: "По центру",
      action: "align-center",
      small: true,
    },
    {
      key: "align-right",
      label: "≡R",
      title: "По правому краю",
      action: "align-right",
      small: true,
    },
    {
      key: "image",
      label: "IMG",
      title: "Вставить картинку в место курсора",
      action: "image",
      small: true,
    },
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

/**
 * Типы, которые принимает хранилище (MediaService.ALLOWED_CONTENT_TYPES). Всё остальное,
 * что лежит в буфере обмена (HTML, RTF, файлы других форматов), вставляется как обычно.
 */
const PASTE_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

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

const CSS_ALIGN: Record<BlockAlign, string> = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayMouseDown = useRef(false);
  const isEdit = Boolean(initial);

  // Диалог выбора файла забирает фокус и сбрасывает выделение, поэтому место
  // курсора запоминается до открытия диалога.
  const savedRangeRef = useRef<Range | null>(null);
  // Картинка нередактируема, поэтому обычное выделение внутрь неё не попадает:
  // запоминаем последнюю, по которой кликнули, чтобы кнопки выравнивания работали.
  const selectedFigureRef = useRef<HTMLElement | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [professionSlug, setProfessionSlug] = useState(
    initial?.professionSlug ?? professions[0]?.slug ?? ""
  );
  const [level, setLevel] = useState<Level>(initial?.level ?? "Middle");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [publish, setPublish] = useState(initial ? initial.published !== false : true);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.professionSlug === professionSlug),
    [categories, professionSlug]
  );
  const [categorySlug, setCategorySlug] = useState(
    initial?.categorySlug ?? visibleCategories[0]?.slug ?? ""
  );

  // HTML исходного ответа считаем один раз: он же служит эталоном для проверки изменений.
  // Картинки теперь часть разметки, поэтому отдельный слепок для них не нужен.
  const initialHtmlRef = useRef(initial ? sectionsToHtml(initial.sections ?? []) : "");

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
    const dirty = initial
      ? title.trim() !== (initial.title ?? "").trim() ||
        tags.trim() !== (initial.tags ?? []).join(", ").trim() ||
        editorRef.current?.innerHTML !== initialHtmlRef.current ||
        level !== initial.level ||
        professionSlug !== initial.professionSlug ||
        effectiveCategorySlug !== initial.categorySlug ||
        publish !== (initial.published !== false)
      : title.trim().length > 0 ||
        tags.trim().length > 0 ||
        editorText.length > 0 ||
        // Картинка без текста тоже считается заполненной формой: файл уже загружен.
        Boolean(editorRef.current?.querySelector("figure[data-image]"));

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
   * Выравнивание блока. Для текста работает штатный execCommand, а картинке
   * стиль ставим напрямую: она contenteditable=false, и выделение внутрь неё не заходит.
   */
  function applyAlign(align: BlockAlign) {
    const editor = editorRef.current;
    if (!editor) return;

    const figure = selectedFigureRef.current;
    if (figure && editor.contains(figure)) {
      figure.style.textAlign = CSS_ALIGN[align];
      return;
    }

    editor.focus();
    if (align === "CENTER") document.execCommand("justifyCenter");
    else if (align === "RIGHT") document.execCommand("justifyRight");
    else document.execCommand("justifyLeft");
  }

  /** Запоминаем место курсора: диалог выбора файла сбросит выделение. */
  function pickImage() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    savedRangeRef.current =
      range && editor?.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
    fileInputRef.current?.click();
  }

  /**
   * Загрузка файла в хранилище и вставка готовой <figure> в место курсора.
   * Общий путь для кнопки IMG и для вставки через Ctrl+V: в базе хранятся только
   * ключи объектов, поэтому base64 из буфера обмена сначала уезжает в /api/admin/media.
   *
   * @param restoreSavedRange восстановить выделение из savedRangeRef: за время загрузки
   *   фокус мог уйти (диалог файла, prompt).
   */
  async function uploadAndInsert(
    file: File,
    meta?: { alt?: string; caption?: string },
    restoreSavedRange = false
  ) {
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadQuestionImage(file);
      const markup = imageToHtml({
        kind: "IMAGE",
        align: "LEFT",
        storageKey: uploaded.storageKey,
        url: uploaded.url,
        // alt необязателен: пустая строка — корректная разметка для декоративной картинки.
        alt: meta?.alt?.trim() ?? "",
        caption: meta?.caption?.trim() || undefined,
        width: uploaded.width,
        height: uploaded.height,
      });

      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const selection = window.getSelection();
      if (restoreSavedRange && selection && savedRangeRef.current) {
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      }

      // Пустой абзац после картинки — единственный способ продолжить набор текста:
      // сама <figure> нередактируема, и курсору было бы негде встать.
      document.execCommand("insertHTML", false, `${markup}<p><br /></p>`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail ?? caught.message
          : "Не удалось загрузить картинку. Допустимы JPG и PNG до 5 МБ."
      );
    } finally {
      setUploading(false);
    }
  }

  /**
   * Выбор файла кнопкой IMG. Описание спрашиваем до загрузки, но не требуем:
   * скриншот чаще всего объясняется соседним текстом. Отмена в prompt отменяет всю вставку.
   */
  async function onImagePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сбрасываем сразу: иначе повторный выбор того же файла не даст события.
    event.target.value = "";
    if (!file) return;

    const alt = window.prompt(
      "Описание картинки для поиска и скринридеров (можно оставить пустым)",
      ""
    );
    if (alt === null) return;

    const caption = window.prompt("Подпись под картинкой (можно оставить пустой)", "") ?? "";

    await uploadAndInsert(file, { alt, caption }, true);
  }

  /**
   * Ctrl+V со скриншотом в буфере. Браузер по умолчанию вставляет <img src="data:...">,
   * который при сохранении молча выбрасывается (parseAnswerHtml берёт только figure
   * с data-storage-key). Поэтому перехватываем вставку и грузим файл в хранилище.
   */
  function onEditorPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    let file: File | null = null;
    for (const candidate of Array.from(clipboard.files ?? [])) {
      if (PASTE_IMAGE_TYPES.has(candidate.type)) {
        file = candidate;
        break;
      }
    }
    if (!file) {
      // Скриншот из «Ножниц» приходит только в items, без files. getAsFile() вызываем
      // синхронно: после выхода из обработчика clipboardData уже очищен.
      for (const item of Array.from(clipboard.items ?? [])) {
        if (item.kind !== "file" || !PASTE_IMAGE_TYPES.has(item.type)) continue;
        const candidate = item.getAsFile();
        if (candidate) {
          file = candidate;
          break;
        }
      }
    }

    // Обычный текст и HTML вставляются браузером как раньше.
    if (!file) return;

    event.preventDefault();
    if (uploading) return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    savedRangeRef.current =
      range && editor?.contains(range.commonAncestorContainer) ? range.cloneRange() : null;

    // Описание не спрашиваем: смысл Ctrl+V в том, чтобы картинка появилась сразу.
    void uploadAndInsert(file, undefined, true);
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
    if (button.action === "image") {
      pickImage();
      return;
    }
    if (button.action === "align-left") {
      applyAlign("LEFT");
      return;
    }
    if (button.action === "align-center") {
      applyAlign("CENTER");
      return;
    }
    if (button.action === "align-right") {
      applyAlign("RIGHT");
      return;
    }
    runCommand(button.command);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const answerHtml = editorRef.current?.innerHTML ?? "";
    const hasImage = Boolean(editorRef.current?.querySelector("figure[data-image]"));
    if (!(editorRef.current?.textContent ?? "").trim() && !hasImage) {
      setError("Заполните текст ответа.");
      return;
    }
    if (!professionSlug || !effectiveCategorySlug) {
      setError("Выберите направление и категорию.");
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
                          disabled={button.action === "image" && uploading}
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
                  onPaste={onEditorPaste}
                  // Клик по картинке делает её целью кнопок выравнивания.
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    const figure = target.closest?.(
                      "figure[data-image]"
                    ) as HTMLElement | null;
                    selectedFigureRef.current =
                      figure && editorRef.current?.contains(figure) ? figure : null;
                  }}
                  data-placeholder="Опишите ответ: теория, примеры кода, подводные камни..."
                />
              </div>
              <p className={styles.hint}>
                Картинку можно вставить из буфера обмена по Ctrl+V или кнопкой IMG — она
                появится там, где стоит курсор, и всегда занимает отдельную строку. Описание
                картинки необязательное. Чтобы выровнять — кликните по картинке и нажмите
                ≡L, ≡C или ≡R. Для текста те же кнопки работают по месту курсора.
                {uploading && " Загружаем картинку..."}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={onImagePicked}
              />
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
            <button type="submit" className={styles.save} disabled={pending || uploading}>
              {pending ? "Сохраняем..." : isEdit ? "Сохранить изменения" : "Сохранить вопрос"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
