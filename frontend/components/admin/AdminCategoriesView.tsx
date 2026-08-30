"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api";
import type { Category, Profession } from "@/lib/types";
import {
  createCategory,
  deleteCategory,
  slugifyTitle,
  updateCategory,
  type CategoryPayload,
} from "@/lib/admin-catalog-api";
import styles from "./AdminCatalog.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

function errorText(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    if (caught.status === 401 || caught.status === 403) {
      return "Сессия истекла или нет прав администратора. Войдите заново.";
    }
    return caught.detail ?? caught.message;
  }
  return fallback;
}

interface CategoryFormModalProps {
  professions: Profession[];
  initial?: Category | null;
  defaultProfessionSlug?: string;
  onClose: () => void;
  onSaved: () => void;
}

function CategoryFormModal({
  professions,
  initial,
  defaultProfessionSlug,
  onClose,
  onSaved,
}: CategoryFormModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayMouseDown = useRef(false);
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [emoji, setEmoji] = useState(initial?.emoji ?? "📁");
  const [professionSlug, setProfessionSlug] = useState(
    initial?.professionSlug ?? defaultProfessionSlug ?? professions[0]?.slug ?? ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugifyTitle(title);

  function requestClose() {
    const dirty = isEdit
      ? title !== initial?.title ||
        emoji !== initial?.emoji ||
        description !== initial?.description
      : title.trim().length > 0;

    if (dirty && !window.confirm("Закрыть окно? Изменения не сохранятся.")) return;
    onClose();
  }

  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Введите название темы.");
      return;
    }
    if (!effectiveSlug) {
      setError("Не удалось собрать адрес. Заполните его вручную латиницей.");
      return;
    }
    if (!professionSlug) {
      setError("Выберите направление.");
      return;
    }

    const payload: CategoryPayload = {
      slug: effectiveSlug,
      title: title.trim(),
      emoji: emoji.trim() || undefined,
      description: description.trim() || undefined,
      professionSlug,
      specializationSlug: initial?.specializationSlug,
    };

    setError(null);
    setPending(true);
    try {
      if (initial) {
        await updateCategory(initial.professionSlug, initial.slug, payload);
      } else {
        await createCategory(payload);
      }
      onSaved();
      onClose();
    } catch (caught) {
      setError(errorText(caught, "Не удалось сохранить тему."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        overlayMouseDown.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (overlayMouseDown.current && event.target === event.currentTarget) {
          requestClose();
        }
        overlayMouseDown.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-category-title"
        className={styles.dialog}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <div className={styles.dialogHead}>
            <h2 className={styles.dialogTitle} id="admin-category-title">
              {isEdit ? "Редактирование темы" : "Новая тема"}
            </h2>
            <button
              type="button"
              className={styles.iconButton}
              onClick={requestClose}
              aria-label="Закрыть окно"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className={styles.dialogBody}>
            <div className={styles.group}>
              <label className={styles.label} htmlFor="admin-category-name">
                Название *
              </label>
              <input
                id="admin-category-name"
                className={styles.input}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: Collections"
              />
            </div>

            <div className={styles.inlineRow}>
              <div className={styles.group}>
                <label className={styles.label} htmlFor="admin-category-emoji">
                  Эмодзи
                </label>
                <input
                  id="admin-category-emoji"
                  className={`${styles.input} ${styles.emojiInput}`}
                  value={emoji}
                  onChange={(event) => setEmoji(event.target.value)}
                  maxLength={4}
                />
              </div>

              <div className={styles.group} style={{ flex: 1 }}>
                <label className={styles.label} htmlFor="admin-category-profession">
                  Направление *
                </label>
                <select
                  id="admin-category-profession"
                  className={styles.select}
                  value={professionSlug}
                  onChange={(event) => setProfessionSlug(event.target.value)}
                  disabled={isEdit}
                >
                  {professions.map((profession) => (
                    <option key={profession.slug} value={profession.slug}>
                      {profession.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="admin-category-slug">
                Адрес страницы
              </label>
              <div className={styles.slugRow}>
                <span className={styles.fieldHint}>/{professionSlug}/</span>
                <input
                  id="admin-category-slug"
                  className={styles.input}
                  value={effectiveSlug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(event.target.value);
                  }}
                  disabled={isEdit}
                />
              </div>
              <span className={styles.fieldHint}>
                {isEdit
                  ? "Адрес и направление не меняются: на них уже ссылаются вопросы."
                  : "Заполняется автоматически из названия."}
              </span>
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="admin-category-description">
                Описание
              </label>
              <textarea
                id="admin-category-description"
                className={styles.textarea}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="О чём эта тема — текст видно на карточке и на странице темы."
              />
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
              {pending ? "Сохраняем..." : isEdit ? "Сохранить изменения" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdminCategoriesViewProps {
  professions: Profession[];
  categories: Category[];
}

export function AdminCategoriesView({
  professions,
  categories,
}: AdminCategoriesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [professionFilter, setProfessionFilter] = useState("all");

  const professionTitles = new Map(professions.map((item) => [item.slug, item.title]));
  const visible =
    professionFilter === "all"
      ? categories
      : categories.filter((item) => item.professionSlug === professionFilter);

  async function onDelete(category: Category) {
    if (!window.confirm(`Удалить тему «${category.title}»? Действие необратимо.`)) return;

    setActionError(null);
    setBusySlug(category.slug);
    try {
      await deleteCategory(category.professionSlug, category.slug);
      window.location.reload();
    } catch (caught) {
      setActionError(errorText(caught, "Не удалось удалить тему."));
      setBusySlug(null);
    }
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Темы</h1>
          <p className={styles.subtitle}>
            Категории базы знаний: нижний уровень каталога, к которому привязаны вопросы.
          </p>
        </div>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          disabled={professions.length === 0}
        >
          <Icon name="plus" size={16} />
          Добавить тему
        </button>
      </div>

      {actionError && (
        <p className={styles.alert} role="alert">
          {actionError}
        </p>
      )}

      <div className={styles.toolbar}>
        <label className={styles.filter}>
          <span className={styles.filterLabel}>Направление:</span>
          <span className={styles.filterValue}>
            {professionFilter === "all"
              ? "Все направления"
              : professionTitles.get(professionFilter) ?? "—"}
          </span>
          <Icon name="chevron-down" size={14} />
          <select
            className={styles.filterSelect}
            value={professionFilter}
            onChange={(event) => setProfessionFilter(event.target.value)}
            aria-label="Направление:"
          >
            <option value="all">Все направления</option>
            {professions.map((profession) => (
              <option key={profession.slug} value={profession.slug}>
                {profession.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headRow}>
                <th scope="col">Тема</th>
                <th scope="col">Направление</th>
                <th scope="col">Вопросов</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((category) => (
                <tr key={`${category.professionSlug}-${category.slug}`} className={styles.row}>
                  <td className={styles.colTitle}>
                    <span className={styles.name}>
                      <span aria-hidden="true">{category.emoji}</span>
                      {category.title}
                    </span>
                    <span className={styles.rowMeta}>
                      /{category.professionSlug}/{category.slug}
                    </span>
                  </td>
                  <td>
                    <span className={styles.metaTag}>
                      {professionTitles.get(category.professionSlug) ?? category.professionSlug}
                    </span>
                  </td>
                  <td className={styles.colCount}>{category.questionCount ?? 0}</td>
                  <td className={styles.colActions}>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Редактировать: ${category.title}`}
                        onClick={() => {
                          setEditing(category);
                          setModalOpen(true);
                        }}
                        disabled={busySlug !== null}
                      >
                        <Icon name="edit-2" size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Удалить: ${category.title}`}
                        onClick={() => void onDelete(category)}
                        disabled={busySlug !== null}
                      >
                        <Icon name="trash-2" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Тем пока нет. Создайте первую.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className={styles.hint}>
          Тему с вопросами удалить нельзя — сначала удалите её вопросы.
        </p>
      </div>

      {modalOpen && (
        <CategoryFormModal
          professions={professions}
          initial={editing}
          defaultProfessionSlug={
            professionFilter === "all" ? undefined : professionFilter
          }
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
