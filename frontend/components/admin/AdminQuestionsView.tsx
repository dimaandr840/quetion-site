"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LevelBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api";
import {
  buildQuestionPayload,
  deleteQuestion,
  getAdminQuestion,
  getAdminQuestions,
  sectionsToHtml,
  updateQuestion,
  type AdminQuestionDetailDto,
} from "@/lib/admin-api";
import { ADMIN_PAGE_SIZE, formatAdminDate, type AdminQuestionRow } from "@/lib/admin";
import { LEVELS } from "@/lib/queries";
import { QuestionFormModal, type QuestionFormOption } from "./QuestionFormModal";
import styles from "./AdminQuestionsView.module.css";

const ALL = "all";

/** Сколько строк-заглушек рисуем на время первой загрузки. */
const SKELETON_ROWS = 5;

/** Сколько миллисекунд живёт всплывающее уведомление об успехе. */
const TOAST_TTL = 3200;

type SortKey = "title" | "category" | "level" | "status" | "date";
type SortDirection = "asc" | "desc";

/** Порядок уровней для сортировки: алфавитный давал бы Junior → Middle → Senior случайно. */
const LEVEL_ORDER: Record<string, number> = { Junior: 0, Middle: 1, Senior: 2 };

interface AdminQuestionsViewProps {
  professions: QuestionFormOption[];
  categories: (QuestionFormOption & { professionSlug: string })[];
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const current = options.find((option) => option.value === value);

  return (
    <label className={styles.filter}>
      <span className={styles.filterLabel}>{label}</span>
      <span className={styles.filterValue}>{current?.label ?? "—"}</span>
      <Icon name="chevron-down" size={14} />
      <select
        className={styles.filterSelect}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Стрелка сортировки в шапке: у неактивной колонки она бледная. */
function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  return (
    <span className={active ? styles.sortIconActive : styles.sortIcon} aria-hidden="true">
      <Icon name={active && direction === "asc" ? "chevron-up" : "chevron-down"} size={14} />
    </span>
  );
}

function errorText(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    if (caught.status === 401 || caught.status === 403) {
      return "Сессия истекла или нет прав администратора. Войдите заново.";
    }
    return caught.detail ?? caught.message;
  }
  return fallback;
}

export function AdminQuestionsView({ professions, categories }: AdminQuestionsViewProps) {
  const [rows, setRows] = useState<AdminQuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const [profession, setProfession] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminQuestionDetailDto | null>(null);

  // setState вызываем только из колбэков промиса: синхронный вызов внутри
  // эффекта запускает каскадный рендер (правило react-hooks/set-state-in-effect).
  const load = useCallback(
    () =>
      getAdminQuestions()
        .then((data) => {
          setRows(
            (data ?? []).map((row) => ({
              slug: row.slug,
              title: row.title,
              professionSlug: row.professionSlug,
              professionTitle: row.professionTitle,
              categorySlug: row.categorySlug,
              categoryTitle: row.categoryTitle,
              level: row.level,
              published: row.published,
              createdAt: row.createdAt,
            }))
          );
          setLoadError(null);
        })
        .catch((caught: unknown) => {
          setLoadError(errorText(caught, "Не удалось загрузить вопросы. Проверьте соединение."));
        })
        .finally(() => {
          setLoading(false);
        }),
    []
  );

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Тост гаснет сам; таймер перезапускается на каждом новом сообщении. */
  useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_TTL);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const professionOptions = useMemo(
    () => [
      { value: ALL, label: "Все направления" },
      // Показываем только направления, по которым есть вопросы: остальные
      // всегда давали бы пустую таблицу.
      ...professions
        .filter((item) => rows.some((row) => row.professionSlug === item.slug))
        .map((item) => ({ value: item.slug, label: item.title })),
    ],
    [professions, rows]
  );

  // Темы фильтруются по выбранному направлению: одно и то же название темы
  // существует в разных профессиях, и общий список давал нулевую выдачу.
  const categoryOptions = useMemo(() => {
    const scoped = categories.filter(
      (item) =>
        (profession === ALL || item.professionSlug === profession) &&
        rows.some(
          (row) => row.categorySlug === item.slug && row.professionSlug === item.professionSlug
        )
    );

    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [{ value: ALL, label: "Все темы" }];
    for (const item of scoped) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      options.push({ value: item.slug, label: item.title });
    }
    return options;
  }, [categories, profession, rows]);

  const levelOptions = useMemo(
    () => [
      { value: ALL, label: "Все уровни" },
      ...LEVELS.map((item) => ({ value: item, label: item })),
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: ALL, label: "Любой статус" },
      { value: "published", label: "Опубликованные" },
      { value: "draft", label: "Черновики" },
    ],
    []
  );

  // Выбранная тема может не относиться к новому направлению.
  const effectiveCategory = categoryOptions.some((option) => option.value === category)
    ? category
    : ALL;

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");

    return rows.filter((row) => {
      if (profession !== ALL && row.professionSlug !== profession) return false;
      if (effectiveCategory !== ALL && row.categorySlug !== effectiveCategory) return false;
      if (level !== ALL && row.level !== level) return false;
      if (status === "published" && !row.published) return false;
      if (status === "draft" && row.published) return false;
      if (needle && !row.title.toLocaleLowerCase("ru").includes(needle)) return false;
      return true;
    });
  }, [rows, profession, effectiveCategory, level, status, query]);

  /**
   * Сортировка клиентская: весь список вопросов и так уже в памяти,
   * отдельный запрос к API ради смены порядка был бы лишним.
   */
  const sorted = useMemo(() => {
    const collator = new Intl.Collator("ru", { sensitivity: "base" });
    const factor = sortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return factor * collator.compare(a.title, b.title);
        case "category":
          return factor * collator.compare(a.categoryTitle, b.categoryTitle);
        case "level":
          return factor * ((LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0));
        case "status":
          return factor * (Number(a.published) - Number(b.published));
        default:
          return (
            factor *
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          );
      }
    });
  }, [filtered, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Для даты логичнее начинать с новых, для текста — с А до Я.
    setSortDirection(key === "date" ? "desc" : "asc");
  }

  function sortLabel(key: SortKey) {
    if (key !== sortKey) return undefined;
    return sortDirection === "asc" ? ("ascending" as const) : ("descending" as const);
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ADMIN_PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + ADMIN_PAGE_SIZE);
  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selected.includes(row.slug));

  // Выбор должен исчезать вместе со строками, которые ушли из выдачи.
  const visibleSelected = selected.filter((slug) => filtered.some((row) => row.slug === slug));

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function toggleRow(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  }

  function togglePage() {
    const slugs = pageRows.map((row) => row.slug);
    setSelected((prev) =>
      allOnPageSelected
        ? prev.filter((item) => !slugs.includes(item))
        : Array.from(new Set([...prev, ...slugs]))
    );
  }

  async function onEdit(slug: string) {
    setActionError(null);
    setBusySlug(slug);
    try {
      const detail = await getAdminQuestion(slug);
      setEditing(detail);
      setModalOpen(true);
    } catch (caught) {
      setActionError(errorText(caught, "Не удалось открыть вопрос на редактирование."));
    } finally {
      setBusySlug(null);
    }
  }

  async function onDelete(row: AdminQuestionRow) {
    if (!window.confirm(`Удалить вопрос «${row.title}»? Действие необратимо.`)) return;

    setActionError(null);
    setBusySlug(row.slug);
    try {
      await deleteQuestion(row.slug);
      setSelected((prev) => prev.filter((item) => item !== row.slug));
      await load();
    } catch (caught) {
      setActionError(errorText(caught, "Не удалось удалить вопрос."));
    } finally {
      setBusySlug(null);
    }
  }

  async function onDeleteSelected() {
    const targets = visibleSelected;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `Удалить выбранные вопросы (${targets.length})? Действие необратимо.`
      )
    ) {
      return;
    }

    setActionError(null);
    setBusySlug("__bulk__");
    const failed: string[] = [];
    for (const slug of targets) {
      try {
        await deleteQuestion(slug);
      } catch {
        failed.push(slug);
      }
    }
    setSelected(failed);
    if (failed.length > 0) {
      setActionError(`Не удалось удалить ${failed.length} из ${targets.length} вопросов.`);
    }
    await load();
    setBusySlug(null);
  }

  /**
   * Публикация/снятие с публикации одним кликом.
   *
   * PUT заменяет весь вопрос, поэтому сначала забираем актуальную версию
   * и пересобираем payload целиком: иначе переключение флажка стёрло бы текст ответа.
   */
  async function onTogglePublish(row: AdminQuestionRow) {
    setActionError(null);
    setBusySlug(row.slug);
    try {
      const detail = await getAdminQuestion(row.slug);
      const next = !row.published;
      await updateQuestion(
        row.slug,
        buildQuestionPayload({
          title: detail.title,
          level: detail.level,
          professionSlug: detail.professionSlug,
          categorySlug: detail.categorySlug,
          tags: detail.tags.join(", "),
          answerHtml: sectionsToHtml(detail.sections),
          published: next,
          slug: detail.slug,
        })
      );
      setRows((prev) =>
        prev.map((item) => (item.slug === row.slug ? { ...item, published: next } : item))
      );
      setToast(next ? "Вопрос опубликован" : "Вопрос скрыт в черновики");
    } catch (caught) {
      setActionError(errorText(caught, "Не удалось изменить статус вопроса."));
    } finally {
      setBusySlug(null);
    }
  }

  /** Групповая смена статуса для выбранных строк. */
  async function onPublishSelected(next: boolean) {
    const targets = visibleSelected;
    if (targets.length === 0) return;

    setActionError(null);
    setBusySlug("__bulk__");
    let failed = 0;
    for (const slug of targets) {
      try {
        const detail = await getAdminQuestion(slug);
        await updateQuestion(
          slug,
          buildQuestionPayload({
            title: detail.title,
            level: detail.level,
            professionSlug: detail.professionSlug,
            categorySlug: detail.categorySlug,
            tags: detail.tags.join(", "),
            answerHtml: sectionsToHtml(detail.sections),
            published: next,
            slug: detail.slug,
          })
        );
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      setActionError(`Не удалось обновить ${failed} из ${targets.length} вопросов.`);
    } else {
      setToast(next ? `Опубликовано: ${targets.length}` : `В черновики: ${targets.length}`);
    }
    await load();
    setBusySlug(null);
  }

  /**
   * Выгрузка текущего среза в CSV для Excel: BOM и точка с запятой обязательны,
   * иначе кириллица превращается в кракозябры, а строка — в одну колонку.
   */
  function onExportCsv() {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = [
      "Вопрос",
      "Направление",
      "Тема",
      "Сложность",
      "Статус",
      "Добавлен",
      "slug",
    ];
    const lines = [header.join(";")];
    for (const row of sorted) {
      lines.push(
        [
          escape(row.title),
          escape(row.professionTitle),
          escape(row.categoryTitle),
          escape(row.level),
          escape(row.published ? "Опубликован" : "Черновик"),
          escape(formatAdminDate(row.createdAt)),
          escape(row.slug),
        ].join(";")
      );
    }

    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `questions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(`Выгружено строк: ${sorted.length}`);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Управление вопросами</h1>
          <p className={styles.subtitle}>
            Создавайте, модерируйте и структурируйте базу знаний интервью.
          </p>
        </div>
        <button type="button" className={styles.addButton} onClick={() => setModalOpen(true)}>
          <Icon name="plus" size={16} />
          Добавить вопрос
        </button>
      </div>

      <div className={styles.toolbar}>
        <FilterSelect
          label="Профессия:"
          value={profession}
          options={professionOptions}
          onChange={resetPage((value: string) => {
            setProfession(value);
            setCategory(ALL);
          })}
        />
        <FilterSelect
          label="Тема:"
          value={effectiveCategory}
          options={categoryOptions}
          onChange={resetPage(setCategory)}
        />
        <FilterSelect
          label="Сложность:"
          value={level}
          options={levelOptions}
          onChange={resetPage(setLevel)}
        />
        <FilterSelect
          label="Статус:"
          value={status}
          options={statusOptions}
          onChange={resetPage(setStatus)}
        />
        <div className={styles.search}>
          <Icon name="search" size={18} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Поиск по вопросам базы..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            aria-label="Поиск по вопросам базы"
          />
        </div>
        <button
          type="button"
          className={styles.exportButton}
          onClick={onExportCsv}
          disabled={loading || sorted.length === 0}
          title="Выгрузить текущую выборку в CSV"
        >
          <Icon name="arrow-right" size={16} />
          Выгрузить CSV
        </button>
      </div>

      {(loadError || actionError) && (
        <p className={styles.alert} role="alert">
          {loadError ?? actionError}
          {loadError && (
            <button type="button" className={styles.retry} onClick={() => void reload()}>
              Повторить
            </button>
          )}
        </p>
      )}

      {visibleSelected.length > 0 && (
        <div className={styles.bulkBar} role="group" aria-label="Действия с выбра��ными вопросами">
          <span className={styles.bulkCount}>Выбрано: {visibleSelected.length}</span>
          <button
            type="button"
            className={styles.bulkDelete}
            onClick={() => void onDeleteSelected()}
            disabled={busySlug !== null}
          >
            <Icon name="trash-2" size={14} />
            Удалить выбранные
          </button>
          <button
            type="button"
            className={styles.bulkAction}
            onClick={() => void onPublishSelected(true)}
            disabled={busySlug !== null}
          >
            <Icon name="check" size={14} />
            Опубликовать
          </button>
          <button
            type="button"
            className={styles.bulkAction}
            onClick={() => void onPublishSelected(false)}
            disabled={busySlug !== null}
          >
            <Icon name="x" size={14} />
            В черновики
          </button>
          <button type="button" className={styles.bulkReset} onClick={() => setSelected([])}>
            Снять выделение
          </button>
        </div>
      )}

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headRow}>
                <th className={styles.checkCell} scope="col">
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allOnPageSelected}
                    onChange={togglePage}
                    aria-label="Выбрать все вопросы на странице"
                  />
                </th>
                <th scope="col" className={styles.colQuestion} aria-sort={sortLabel("title")}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => toggleSort("title")}
                  >
                    Текст вопроса
                    <SortIcon active={sortKey === "title"} direction={sortDirection} />
                  </button>
                </th>
                <th scope="col" className={styles.colCategory} aria-sort={sortLabel("category")}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => toggleSort("category")}
                  >
                    Тема
                    <SortIcon active={sortKey === "category"} direction={sortDirection} />
                  </button>
                </th>
                <th scope="col" className={styles.colLevel} aria-sort={sortLabel("level")}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => toggleSort("level")}
                  >
                    Сложность
                    <SortIcon active={sortKey === "level"} direction={sortDirection} />
                  </button>
                </th>
                <th scope="col" className={styles.colStatus} aria-sort={sortLabel("status")}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => toggleSort("status")}
                  >
                    Статус
                    <SortIcon active={sortKey === "status"} direction={sortDirection} />
                  </button>
                </th>
                <th scope="col" className={styles.colDate} aria-sort={sortLabel("date")}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => toggleSort("date")}
                  >
                    Добавлен
                    <SortIcon active={sortKey === "date"} direction={sortDirection} />
                  </button>
                </th>
                <th scope="col" className={styles.colActions}>
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.slug} className={styles.row}>
                  <td className={styles.checkCell}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selected.includes(row.slug)}
                      onChange={() => toggleRow(row.slug)}
                      aria-label={`Выбрать вопрос: ${row.title}`}
                    />
                  </td>
                  <td className={styles.colQuestion}>
                    <span className={styles.questionTitle}>{row.title}</span>
                    <span className={styles.questionMeta}>
                      Направление: {row.professionTitle}
                    </span>
                  </td>
                  <td className={styles.colCategory}>
                    <span className={styles.metaTag}>{row.categoryTitle}</span>
                  </td>
                  <td className={styles.colLevel}>
                    <LevelBadge level={row.level} />
                  </td>
                  <td className={styles.colStatus}>
                    <span
                      className={`${styles.statusDot} ${
                        row.published ? styles.dotPublished : styles.dotDraft
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={row.published ? styles.statusPublished : styles.statusDraft}
                    >
                      {row.published ? "Опубликован" : "Черновик"}
                    </span>
                  </td>
                  <td className={styles.colDate}>{formatAdminDate(row.createdAt)}</td>
                  <td className={styles.colActions}>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={
                          row.published
                            ? `Снять с публикации: ${row.title}`
                            : `Опубликовать: ${row.title}`
                        }
                        title={row.published ? "Снять с публикации" : "Опубликовать"}
                        onClick={() => void onTogglePublish(row)}
                        disabled={busySlug !== null}
                      >
                        <Icon name={row.published ? "x" : "check"} size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Редактировать: ${row.title}`}
                        onClick={() => void onEdit(row.slug)}
                        disabled={busySlug !== null}
                      >
                        <Icon name="edit-2" size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Удалить: ${row.title}`}
                        onClick={() => void onDelete(row)}
                        disabled={busySlug !== null}
                      >
                        <Icon name="trash-2" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* На первой загрузке вместо текста «Загружаем...» рисуем скелетон:
                  разметка не прыгает, когда приходят данные. */}
              {loading &&
                pageRows.length === 0 &&
                Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <tr key={`skeleton-${index}`} className={styles.row} aria-hidden="true">
                    {Array.from({ length: 7 }, (__, cell) => (
                      <td key={cell}>
                        <span className={`skeleton ${styles.skeletonLine}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    {loadError
                      ? "Список недоступен."
                      : "По выбранным фильтрам вопросов не найдено."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <p className={styles.paginationInfo}>
            Показано{" "}
            <strong>
              {filtered.length === 0 ? 0 : `${pageStart + 1}-${pageStart + pageRows.length}`}
            </strong>{" "}
            из <strong>{filtered.length}</strong> вопросов
          </p>
          <div className={styles.pages}>
            <button
              type="button"
              className={styles.pageArrow}
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Предыдущая страница"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            {pageNumbers.map((item, index) =>
              item === null ? (
                <span key={`gap-${index}`} className={styles.pageGap} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`${styles.pageButton} ${
                    item === currentPage ? styles.pageButtonActive : ""
                  }`}
                  onClick={() => setPage(item)}
                  aria-current={item === currentPage ? "page" : undefined}
                  aria-label={`Страница ${item}`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              className={styles.pageArrow}
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Следующая страница"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Уведомления об успешных действиях; ошибки остаются в блоке выше,
          чтобы их нельзя было пропустить. */}
      <div className={styles.toastArea} role="status" aria-live="polite">
        {toast && <div className={styles.toast}>{toast}</div>}
      </div>

      {modalOpen && (
        <QuestionFormModal
          key={editing?.slug ?? "new"}
          professions={professions}
          categories={categories}
          initial={editing}
          onClose={closeModal}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}

/**
 * Окно страниц вокруг текущей: раньше всегда показывались 1, 2, 3,
 * даже когда пользователь стоял в конце списка.
 */
function buildPageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result: (number | null)[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null);
    result.push(page);
  });

  return result;
}
