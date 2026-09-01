import { apiFetch } from "./api";
import { sanitizeInlineHtml, stripInlineHtml } from "./inline-html";
import type { BlockAlign, Level } from "./types";

/**
 * Блок ответа в запросе апсерта.
 *
 * У картинки на запись уходит только `storageKey` — ключ объекта, выданный
 * POST /api/admin/media. Поле `url` бэкенд игнорирует и всегда пересчитывает сам,
 * поэтому подменить домен через форму нельзя.
 */
export interface AnswerBlockPayload {
  kind: "PARAGRAPH" | "IMAGE";
  align?: BlockAlign;
  text?: string;
  storageKey?: string;
  url?: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface AnswerSectionPayload {
  id?: string;
  heading?: string;
  blocks?: AnswerBlockPayload[];
  bullets?: string[];
  code?: { language: string; title: string; lines: string[] };
}

/** Картинка вопроса, как её отдаёт бэкенд справочным списком. */
export interface QuestionImagePayload {
  storageKey: string;
  url?: string;
  /** Может быть пустым: описание картинки необязательное. */
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface QuestionUpsertPayload {
  slug: string;
  title: string;
  level: Level;
  professionSlug: string;
  categorySlug: string;
  tags: string[];
  snippet: string;
  tldr: string;
  popular: boolean;
  published: boolean;
  sections: AnswerSectionPayload[];
}

/** Строка админской таблицы, как её отдаёт GET /api/admin/questions. */
export interface AdminQuestionRowDto {
  slug: string;
  title: string;
  professionSlug: string;
  professionTitle: string;
  categorySlug: string;
  categoryTitle: string;
  level: Level;
  published: boolean;
  createdAt: string;
}

/** Полный вопрос для режима редактирования. */
export interface AdminQuestionDetailDto {
  slug: string;
  title: string;
  level: Level;
  professionSlug: string;
  categorySlug: string;
  tags: string[];
  popular: boolean;
  published?: boolean;
  sections: AnswerSectionPayload[];
  /** Отсутствует, если у вопроса нет картинок: бэкенд не отдаёт пустые поля. */
  images?: QuestionImagePayload[];
}

/** Заголовок по умолчанию, если админ не выделил в ответе ни одного H1/H2. */
const DEFAULT_SECTION_HEADING = "Ответ";

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

/** Транслитерация заголовка в slug: бэкенд требует его, а форма не спрашивает. */
export function slugify(title: string): string {
  const base = title
    .toLocaleLowerCase("ru")
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (base || "question").slice(0, 110);
}

function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Содержимое блока вместе с инлайн-разметкой: курсив, полужирный, строчный код,
 * выделение и ссылки. Разметка проходит через санитайзер сразу при сохранении,
 * поэтому в базу не попадает ничего, кроме разрешённых тегов.
 */
function inlineOf(element: Element): string {
  const html = sanitizeInlineHtml(element.innerHTML).replace(/\s+/g, " ").trim();
  // Разметка без текста (например, пустой <strong>) считается пустым блоком.
  return stripInlineHtml(html) ? html : "";
}

/**
 * Выравнивание блока. contenteditable по командам justifyCenter/justifyRight
 * ставит именно inline-стиль text-align, поэтому читаем его, а не классы.
 */
function alignOf(element: Element): BlockAlign {
  const raw = (element as HTMLElement).style?.textAlign ?? "";
  if (raw === "center") return "CENTER";
  if (raw === "right") return "RIGHT";
  return "LEFT";
}

/** Теги, которые начинают новый блок. Всё остальное считается инлайновым. */
const BLOCK_TAGS = new Set([
  "h1", "h2", "h3", "h4", "p", "div", "ul", "ol", "pre", "blockquote",
  "section", "article", "figure", "table", "hr",
]);

function isBlockNode(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    BLOCK_TAGS.has((node as Element).tagName.toLowerCase())
  );
}

function hasBlockChild(element: Element): boolean {
  return Array.from(element.childNodes).some(isBlockNode);
}

/**
 * Текст блока кода построчно. В contenteditable перевод строки внутри {@code <pre>}
 * — это {@code <br>} или вложенный {@code <div>}, а textContent их склеивает.
 */
function codeLines(element: Element): string[] {
  const clone = element.cloneNode(true) as Element;
  for (const br of Array.from(clone.querySelectorAll("br"))) {
    br.replaceWith(document.createTextNode("\n"));
  }
  for (const block of Array.from(clone.querySelectorAll("div, p"))) {
    block.appendChild(document.createTextNode("\n"));
  }

  const lines = (clone.textContent ?? "").replace(/\r/g, "").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines;
}

/**
 * Разбивает содержимое блока по {@code <br>} на отдельные строки с инлайн-разметкой.
 * Каждая строка становится самостоятельным абзацем.
 */
function splitByBreaks(element: Element): string[] {
  const parts: string[] = [];
  let holder = document.createElement("div");

  const flush = () => {
    const markup = inlineOf(holder);
    if (markup) parts.push(markup);
    holder = document.createElement("div");
  };

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === "br") {
      flush();
      continue;
    }
    holder.appendChild(node.cloneNode(true));
  }
  flush();

  return parts;
}

/**
 * Разбирает HTML из contenteditable-редактора в секции ответа.
 * Каждый h1/h2 начинает новую секцию; абзацы, картинки, списки и блоки кода
 * попадают в текущую. Порядок абзацев и картинок сохраняется.
 */
export function parseAnswerHtml(html: string): AnswerSectionPayload[] {
  const root = document.createElement("div");
  // Строка формируется самим редактором в этом же документе и никуда не
  // вставляется как разметка — используется только для чтения текста.
  root.innerHTML = html;

  const sections: AnswerSectionPayload[] = [];
  let current: AnswerSectionPayload | null = null;
  let index = 0;

  function ensure(heading?: string): AnswerSectionPayload {
    if (!current || heading !== undefined) {
      index += 1;
      current = {
        id: `section-${index}`,
        heading,
        blocks: [],
        bullets: [],
      };
      sections.push(current);
    }
    return current;
  }

  function pushParagraphs(section: AnswerSectionPayload, lines: string[], align: BlockAlign) {
    for (const line of lines) {
      section.blocks?.push({ kind: "PARAGRAPH", align, text: line });
    }
  }

  /**
   * Редактор охотно вкладывает блоки друг в друга: список после Enter уезжает
   * внутрь <div>, код — внутрь <pre> с <br>. Поэтому обход рекурсивный, а не по
   * верхнему уровню: иначе вложенный <ul> схлопывался в текст и пункты пропадали.
   */
  function walk(nodes: Node[]) {
    // Голый текст между блоками (в том числе первая строка, пока не нажат Enter)
    // копится и сбрасывается одним абзацем.
    let inline: Node[] = [];

    function flushInline() {
      if (inline.length === 0) return;
      const holder = document.createElement("div");
      for (const node of inline) holder.appendChild(node.cloneNode(true));
      inline = [];
      const lines = splitByBreaks(holder);
      if (lines.length === 0) return;
      pushParagraphs(ensure(), lines, "LEFT");
    }

    for (const node of nodes) {
      if (!isBlockNode(node)) {
        inline.push(node);
        continue;
      }

      flushInline();
      const element = node as Element;
      const tag = element.tagName.toLowerCase();

      if (tag === "hr") {
        continue;
      }

      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
        ensure(textOf(element) || undefined);
        continue;
      }

      // Картинка вставлена редактором: всё нужное лежит в data-атрибутах, а не в src:
      // адрес зависит от домена хранилища и на запись не уходит.
      if (tag === "figure" && element.getAttribute("data-image") === "1") {
        const storageKey = element.getAttribute("data-storage-key") ?? "";
        const image = element.querySelector("img");
        // Описание необязательное: у вставленного скриншота его обычно нет, а пустой alt
        // — корректная разметка для декоративной картинки.
        const alt = element.getAttribute("data-alt") || image?.getAttribute("alt") || "";
        if (!storageKey) {
          // Без ключа бэкенд всё равно ответит ошибкой.
          continue;
        }
        const captionNode = element.querySelector("figcaption");
        const caption = (captionNode?.textContent ?? element.getAttribute("data-caption") ?? "").trim();
        const width = Number(element.getAttribute("data-width")) || undefined;
        const height = Number(element.getAttribute("data-height")) || undefined;

        ensure().blocks?.push({
          kind: "IMAGE",
          align: alignOf(element),
          storageKey,
          alt: alt.trim(),
          caption: caption || undefined,
          width,
          height,
        });
        continue;
      }

      if (tag === "ul" || tag === "ol") {
        const section = ensure();
        for (const item of Array.from(element.querySelectorAll("li"))) {
          const markup = inlineOf(item);
          if (markup) section.bullets?.push(markup);
        }
        continue;
      }

      if (tag === "pre") {
        const section = ensure();
        const lines = codeLines(element);
        if (lines.length > 0) {
          section.code = { language: "java", title: "Пример", lines };
        }
        continue;
      }

      // Отдельного поля для цитаты в модели ответа нет, поэтому строки цитаты
      // сохраняются абзацами — иначе они склеивались бы в один.
      if (tag === "blockquote") {
        const lines = splitByBreaks(element);
        if (lines.length === 0) continue;
        pushParagraphs(ensure(), lines, alignOf(element));
        continue;
      }

      if (hasBlockChild(element)) {
        walk(Array.from(element.childNodes));
        continue;
      }

      const lines = splitByBreaks(element);
      if (lines.length === 0) continue;
      pushParagraphs(ensure(), lines, alignOf(element));
    }

    flushInline();
  }

  walk(Array.from(root.childNodes));

  return sections.map((section) => ({
    ...section,
    // Бэкенд требует непустой заголовок секции (@NotBlank), а ответ без H1/H2
    // — обычный случай. Подставляем нейтральный заголовок вместо ошибки 400.
    heading: section.heading?.trim() ? section.heading.trim() : DEFAULT_SECTION_HEADING,
    blocks: section.blocks?.length ? section.blocks : undefined,
    bullets: section.bullets?.length ? section.bullets : undefined,
  }));
}

function plainText(sections: AnswerSectionPayload[]): string {
  return sections
    .flatMap((section) => [
      section.heading ?? "",
      // Подписи и alt картинок тоже текст: они осмысленны в поиске.
      ...(section.blocks ?? []).map((block) =>
        block.kind === "IMAGE" ? block.caption || block.alt || "" : block.text ?? ""
      ),
      ...(section.bullets ?? []),
    ])
    .filter(Boolean)
    // snippet и tldr идут в поиск и в мета-описания — там разметка не нужна.
    .map(stripInlineHtml)
    .join(" ")
    .trim();
}

/** Первый текстовый абзац ответа: картинка в качестве краткой сути бесполезна. */
function firstParagraph(sections: AnswerSectionPayload[]): string {
  for (const section of sections) {
    for (const block of section.blocks ?? []) {
      if (block.kind === "PARAGRAPH" && block.text) return block.text;
    }
  }
  return "";
}

export function buildQuestionPayload(input: {
  title: string;
  level: Level;
  professionSlug: string;
  categorySlug: string;
  tags: string;
  answerHtml: string;
  published: boolean;
  slug?: string;
}): QuestionUpsertPayload {
  const sections = parseAnswerHtml(input.answerHtml);
  const flat = plainText(sections);

  return {
    // При редактировании slug сохраняем: он уже в ссылках и в индексе поиска.
    slug: input.slug ?? slugify(input.title),
    title: input.title.trim(),
    level: input.level,
    professionSlug: input.professionSlug,
    categorySlug: input.categorySlug,
    tags: input.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    // Форма не собирает отдельные «краткий ответ» и «превью» — выводим их
    // из текста ответа, как это делает сид базы знаний.
    snippet: flat.slice(0, 1024) || input.title.trim(),
    tldr:
      stripInlineHtml(firstParagraph(sections)) ||
      flat.slice(0, 512) ||
      input.title.trim(),
    popular: false,
    published: input.published,
    sections,
  };
}

function alignStyle(align?: BlockAlign): string {
  if (align === "CENTER") return ' style="text-align:center"';
  if (align === "RIGHT") return ' style="text-align:right"';
  return "";
}

/**
 * Обратное преобразование секций в HTML редактора — нужно для режима
 * редактирования. Инлайн-разметка уже санитизирована при сохранении,
 * но прогоняем её ещё раз: содержимое приходит по сети.
 */
export function sectionsToHtml(sections: AnswerSectionPayload[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    if (section.heading) {
      parts.push(`<h2>${escapeHtml(section.heading)}</h2>`);
    }
    for (const block of section.blocks ?? []) {
      if (block.kind === "IMAGE") {
        parts.push(imageToHtml(block));
        continue;
      }
      parts.push(`<p${alignStyle(block.align)}>${sanitizeInlineHtml(block.text ?? "")}</p>`);
    }
    const bullets = section.bullets ?? [];
    if (bullets.length > 0) {
      parts.push(
        `<ul>${bullets.map((bullet) => `<li>${sanitizeInlineHtml(bullet)}</li>`).join("")}</ul>`
      );
    }
    if (section.code?.lines?.length) {
      parts.push(`<pre>${escapeHtml(section.code.lines.join("\n"))}</pre>`);
    }
  }

  return parts.join("");
}

/**
 * Разметка картинки в редакторе. Сама <figure> не редактируется (contenteditable=false):
 * иначе курсор заходит внутрь и ломает data-атрибуты, по которым собирается блок.
 */
export function imageToHtml(block: AnswerBlockPayload): string {
  const attributes = [
    'data-image="1"',
    `data-storage-key="${escapeHtml(block.storageKey ?? "")}"`,
    `data-alt="${escapeHtml(block.alt ?? "")}"`,
  ];
  if (block.caption) attributes.push(`data-caption="${escapeHtml(block.caption)}"`);
  if (block.width) attributes.push(`data-width="${block.width}"`);
  if (block.height) attributes.push(`data-height="${block.height}"`);

  const caption = block.caption
    ? `<figcaption>${escapeHtml(block.caption)}</figcaption>`
    : "";

  return (
    `<figure ${attributes.join(" ")} contenteditable="false"${alignStyle(block.align)}>` +
    `<img src="${escapeHtml(block.url ?? "")}" alt="${escapeHtml(block.alt ?? "")}" />` +
    `${caption}</figure>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getAdminQuestions() {
  return apiFetch<AdminQuestionRowDto[]>("/admin/questions");
}

export function getAdminQuestion(slug: string) {
  return apiFetch<AdminQuestionDetailDto>(`/admin/questions/${encodeURIComponent(slug)}`);
}

export function createQuestion(payload: QuestionUpsertPayload) {
  return apiFetch<unknown>("/admin/questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateQuestion(slug: string, payload: QuestionUpsertPayload) {
  return apiFetch<unknown>(`/admin/questions/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteQuestion(slug: string) {
  return apiFetch<void>(`/admin/questions/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}
