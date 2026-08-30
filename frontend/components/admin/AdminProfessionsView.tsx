"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api";
import type { Industry, Profession } from "@/lib/types";
import {
  createProfession,
  deleteProfession,
  slugifyTitle,
  updateProfession,
  type ProfessionPayload,
} from "@/lib/admin-catalog-api";
import styles from "./AdminCatalog.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

interface ProfessionFormModalProps {
  industries: Industry[];
  initial?: Profession | null;
  onClose: () => void;
  onSaved: () => void;
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

function ProfessionFormModal({
  industries,
  initial,
  onClose,
  onSaved,
}: ProfessionFormModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayMouseDown = useRef(false);
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  // Пока админ не правил slug руками, он следует за названием.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [emoji, setEmoji] = useState(initial?.emoji ?? "💼");
  const [industrySlug, setIndustrySlug] = useState(
    initial?.industrySlug ?? industries[0]?.slug ?? ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [featured, setFeatured] = useState(Boolean(initial?.featured));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugifyTitle(title);

  function requestClose() {
    const dirty = isEdit
      ? title !== initial?.title ||
        emoji !== initial?.emoji ||
        industrySlug !== initial?.industrySlug ||
        description !== initial?.description ||
        featured !== Boolean(initial?.featured)
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
      setError("Введите название направления.");
      return;
    }
    if (!effectiveSlug) {
      setError("Не удалось собрать адрес. Заполните его вручную латиницей.");
      return;
    }
    if (!industrySlug) {
      setError("Выберите сферу.");
      return;
    }

    const payload: ProfessionPayload = {
      slug: effectiveSlug,
      title: title.trim(),
      emoji: emoji.trim() || undefined,
      description: description.trim() || undefined,
      cardDescription: description.trim() || undefined,
      industrySlug,
      featured,
    };

    setError(null);
    setPending(true);
    try {
      if (initial) {
        await updateProfession(initial.slug, payload);
      } else {
        await createProfession(payload);
      }
      onSaved();
      onClose();
    } catch (caught) {
      setError(errorText(caught, "Не удалось сохранить направление."));
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
        aria-labelledby="admin-profession-title"
        className={styles.dialog}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <div className={styles.dialogHead}>
            <h2 className={styles.dialogTitle} id="admin-profession-title">
              {isEdit ? "Редактирование направления" : "Новое направление"}
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
              <label className={styles.label} htmlFor="admin-profession-name">
                Название *
              </label>
              <input
                id="admin-profession-name"
                className={styles.input}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: QA Engineer"
              />
            </div>

            <div className={styles.inlineRow}>
              <div className={styles.group}>
                <label className={styles.label} htmlFor="admin-profession-emoji">
                  Эмодзи
                </label>
                <input
                  id="admin-profession-emoji"
                  className={`${styles.input} ${styles.emojiInput}`}
                  value={emoji}
                  onChange={(event) => setEmoji(event.target.value)}
                  maxLength={4}
                />
              </div>

              <div className={styles.group} style={{ flex: 1 }}>
                <label className={styles.label} htmlFor="admin-profession-industry">
                  Сфера *
                </label>
                <select
                  id="admin-profession-industry"
                  className={styles.select}
                  value={industrySlug}
                  onChange={(event) => setIndustrySlug(event.target.value)}
                >
                  {industries.map((industry) => (
                    <option key={industry.slug} value={industry.slug}>
                      {industry.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="admin-profession-slug">
                Адрес страницы
              </label>
              <div className={styles.slugRow}>
                <span className={styles.fieldHint}>/professions/</span>
                <input
                  id="admin-profession-slug"
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
                  ? "Адрес не меняется: на него уже ссылаются вопросы и поиск."
                  : "Заполняется автоматически из названия."}
              </span>
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="admin-profession-description">
                Описание
              </label>
              <textarea
                id="admin-profession-description"
                className={styles.textarea}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Коротко о направлении — текст попадёт на карточку и страницу."
              />
            </div>

            <div className={styles.toggleRow}>
              <span className={styles.toggleTexts}>
                <span className={styles.toggleTitle}>Показывать на главной</span>
                <span className={styles.toggleHint}>
                  Направление попадёт в блок «Популярные профессии».
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={featured}
                aria-label="Показывать на главной"
                className={`${styles.switch} ${featured ? styles.switchOn : ""}`}
                onClick={() => setFeatured((value) => !value)}
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
              {pending ? "Сохраняем..." : isEdit ? "Сохранить изменения" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdminProfessionsViewProps {
  professions: Profession[];
  industries: Industry[];
}

export function AdminProfessionsView({
  professions,
  industries,
}: AdminProfessionsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profession | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [industryFilter, setIndustryFilter] = useState("all");

  const industryTitles = new Map(industries.map((item) => [item.slug, item.title]));
  const visible =
    industryFilter === "all"
      ? professions
      : professions.filter((item) => item.industrySlug === industryFilter);

  async function onDelete(profession: Profession) {
    if (
      !window.confirm(
        `Удалить направление «${profession.title}»? Вместе с ним удалятся его темы.`
      )
    ) {
      return;
    }

    setActionError(null);
    setBusySlug(profession.slug);
    try {
      await deleteProfession(profession.slug);
      // Список приходит из серверного компонента, поэтому обновляем страницу целиком.
      window.location.reload();
    } catch (caught) {
      setActionError(errorText(caught, "Не удалось удалить направление."));
      setBusySlug(null);
    }
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Направления</h1>
          <p className={styles.subtitle}>
            Верхний уровень каталога: сфера → направление → тема → вопросы.
          </p>
        </div>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          disabled={industries.length === 0}
        >
          <Icon name="plus" size={16} />
          Добавить направление
        </button>
      </div>

      {actionError && (
        <p className={styles.alert} role="alert">
          {actionError}
        </p>
      )}

      <div className={styles.toolbar}>
        <label className={styles.filter}>
          <span className={styles.filterLabel}>Сфера:</span>
          <span className={styles.filterValue}>
            {industryFilter === "all"
              ? "Все сферы"
              : industryTitles.get(industryFilter) ?? "—"}
          </span>
          <Icon name="chevron-down" size={14} />
          <select
            className={styles.filterSelect}
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value)}
            aria-label="Сфера:"
          >
            <option value="all">Все сферы</option>
            {industries.map((industry) => (
              <option key={industry.slug} value={industry.slug}>
                {industry.title}
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
                <th scope="col">Направление</th>
                <th scope="col">Сфера</th>
                <th scope="col">Вопросов</th>
                <th scope="col">На главной</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((profession) => (
                <tr key={profession.slug} className={styles.row}>
                  <td className={styles.colTitle}>
                    <span className={styles.name}>
                      <span aria-hidden="true">{profession.emoji}</span>
                      {profession.title}
                    </span>
                    <span className={styles.rowMeta}>/{profession.slug}</span>
                  </td>
                  <td>
                    <span className={styles.metaTag}>
                      {industryTitles.get(profession.industrySlug) ?? profession.industrySlug}
                    </span>
                  </td>
                  <td className={styles.colCount}>{profession.questionCount ?? 0}</td>
                  <td className={styles.colCount}>
                    {profession.featured ? "Да" : "—"}
                  </td>
                  <td className={styles.colActions}>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Редактировать: ${profession.title}`}
                        onClick={() => {
                          setEditing(profession);
                          setModalOpen(true);
                        }}
                        disabled={busySlug !== null}
                      >
                        <Icon name="edit-2" size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Удалить: ${profession.title}`}
                        onClick={() => void onDelete(profession)}
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
                  <td colSpan={5} className={styles.empty}>
                    Направлений пока нет. Создайте первое.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className={styles.hint}>
          Направление с вопросами удалить нельзя — сначала удалите его вопросы.
        </p>
      </div>

      {modalOpen && (
        <ProfessionFormModal
          industries={industries}
          initial={editing}
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
