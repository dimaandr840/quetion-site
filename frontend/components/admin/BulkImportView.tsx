"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createQuestion, getAdminQuestions, updateQuestion } from "@/lib/admin-api";
import type { AdminQuestionRowDto } from "@/lib/admin-api";
import { createCategory, getCategories } from "@/lib/admin-catalog-api";
import { ApiError } from "@/lib/api";
import { buildImportPlan, summarizePlan } from "@/lib/bulk-import";
import type { ImportPlan, ReportItem } from "@/lib/bulk-import";
import { Icon } from "../ui/Icon";
import styles from "./BulkImportView.module.css";

type Stage = "idle" | "parsing" | "ready" | "importing" | "done";

interface RowResult {
  index: number;
  title: string;
  outcome: "created" | "updated" | "skipped" | "failed";
  message?: string;
}

const OUTCOME_LABELS: Record<RowResult["outcome"], string> = {
  created: "создан",
  updated: "обновлён",
  skipped: "пропущен",
  failed: "ошибка",
};

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "неизвестная ошибка";
}

export function BulkImportView() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [existing, setExisting] = useState<Map<string, AdminQuestionRowDto>>(new Map());
  const [knownCategories, setKnownCategories] = useState<Set<string>>(new Set());

  const [published, setPublished] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  const [onlyCategory, setOnlyCategory] = useState("");
  const [limit, setLimit] = useState("");

  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);

  const summary = useMemo(() => (plan ? summarizePlan(plan) : null), [plan]);

  const missingCategories = useMemo(() => {
    if (!plan) return [] as string[];
    const needed = new Set(
      plan.items.filter((item) => item.payload).map((item) => item.categorySlug)
    );
    return [...needed].filter((slug) => slug && !knownCategories.has(slug));
  }, [plan, knownCategories]);

  /**
   * Разбор файла. Сам .mjs исполняется на своей же ручке /admin/import/parse:
   * в браузере это запрещено политикой безопасности админки.
   */
  const handleFile = useCallback(
    async (file: File) => {
      setStage("parsing");
      setError(null);
      setPlan(null);
      setResults([]);
      setProgress(0);
      setFileName(file.name);

      try {
        const source = await file.text();
        const response = await fetch("/admin/import/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ source }),
        });

        const body = (await response.json()) as { data?: unknown; error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? `Ошибка разбора файла (${response.status})`);
        }

        const parsedLimit = Number.parseInt(limit, 10);
        const nextPlan = buildImportPlan((body.data ?? {}) as Record<string, unknown>, {
          published,
          onlyCategory: onlyCategory.trim() || undefined,
          limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
        });

        // Существующие вопросы и темы нужны для отчёта: без них нельзя сказать,
        // что поедет на создание, а что — на обновление.
        const [rows, categories] = await Promise.all([
          getAdminQuestions(),
          nextPlan.professionSlug ? getCategories(nextPlan.professionSlug) : Promise.resolve([]),
        ]);

        setExisting(new Map(rows.map((row) => [row.slug, row])));
        setKnownCategories(new Set(categories.map((category) => category.slug)));
        setPlan(nextPlan);
        setStage("ready");
      } catch (cause) {
        setError(errorText(cause));
        setStage("idle");
      }
    },
    [limit, onlyCategory, published]
  );

  const startImport = useCallback(async () => {
    if (!plan) return;

    setStage("importing");
    setError(null);
    setResults([]);
    setProgress(0);

    const queue = plan.items.filter((item): item is ReportItem & { payload: NonNullable<ReportItem["payload"]> } =>
      Boolean(item.payload)
    );

    try {
      if (createMissingCategories) {
        for (const slug of missingCategories) {
          const declared = plan.categories.find((category) => category.slug === slug);
          await createCategory({
            slug,
            title: declared?.title ?? slug,
            emoji: declared?.emoji,
            description: declared?.description,
            professionSlug: plan.professionSlug,
          });
        }
        setKnownCategories((previous) => new Set([...previous, ...missingCategories]));
      }
    } catch (cause) {
      setError(`Не удалось создать темы: ${errorText(cause)}`);
      setStage("ready");
      return;
    }

    const collected: RowResult[] = [];

    for (const [position, item] of queue.entries()) {
      const known = existing.get(item.slug);

      try {
        if (known && !updateExisting) {
          collected.push({ index: item.index, title: item.title, outcome: "skipped", message: "уже есть в базе" });
        } else if (known) {
          await updateQuestion(item.slug, item.payload);
          collected.push({ index: item.index, title: item.title, outcome: "updated" });
        } else {
          await createQuestion(item.payload);
          collected.push({ index: item.index, title: item.title, outcome: "created" });
        }
      } catch (cause) {
        collected.push({
          index: item.index,
          title: item.title,
          outcome: "failed",
          message: errorText(cause),
        });
      }

      setProgress(position + 1);
      setResults([...collected]);
    }

    setStage("done");
  }, [createMissingCategories, existing, missingCategories, plan, updateExisting]);

  const validCount = summary?.valid ?? 0;
  const failedCount = results.filter((result) => result.outcome === "failed").length;

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Импорт вопросов</h1>
          <p className={styles.subtitle}>
            Файл <code>.mjs</code> формата <code>scripts/data/*.mjs</code>: сначала проверка,
            потом загрузка только корректных вопросов.
          </p>
        </div>
      </header>

      {error ? (
        <div className={styles.alert} role="alert">
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <section className={styles.card}>
        <div className={styles.dropzone}>
          <Icon name="plus" size={24} />
          <p className={styles.dropTitle}>{fileName || "Файл не выбран"}</p>
          <p className={styles.dropHint}>
            Ожидается <code>export default</code> с полями professionSlug, categories и questions.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".mjs,.js"
            className={styles.fileInput}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className={styles.primary}
            disabled={stage === "parsing" || stage === "importing"}
            onClick={() => inputRef.current?.click()}
          >
            {stage === "parsing" ? "Проверяем…" : "Выбрать файл"}
          </button>
        </div>

        <div className={styles.options}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
              disabled={stage === "importing"}
            />
            Публиковать сразу (иначе — черновики)
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(event) => setUpdateExisting(event.target.checked)}
              disabled={stage === "importing"}
            />
            Обновлять вопросы, которые уже есть
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={createMissingCategories}
              onChange={(event) => setCreateMissingCategories(event.target.checked)}
              disabled={stage === "importing"}
            />
            Создавать отсутствующие темы
          </label>
          <label className={styles.field}>
            Только тема
            <input
              type="text"
              value={onlyCategory}
              placeholder="например, ООП"
              onChange={(event) => setOnlyCategory(event.target.value)}
              disabled={stage === "importing"}
            />
          </label>
          <label className={styles.field}>
            Лимит вопросов
            <input
              type="number"
              min={1}
              value={limit}
              placeholder="все"
              onChange={(event) => setLimit(event.target.value)}
              disabled={stage === "importing"}
            />
          </label>
          <p className={styles.fieldHint}>
            Настройки применяются при проверке файла — после изменения выберите файл заново.
          </p>
        </div>
      </section>

      {plan && summary ? (
        <section className={styles.card}>
          <div className={styles.summaryRow}>
            <span className={styles.metric}>
              <b>{summary.total}</b> в файле
            </span>
            <span className={`${styles.metric} ${styles.metricOk}`}>
              <b>{summary.valid}</b> готовы к загрузке
            </span>
            <span className={`${styles.metric} ${summary.invalid ? styles.metricBad : ""}`}>
              <b>{summary.invalid}</b> с ошибками
            </span>
            <span className={styles.metric}>
              Junior {summary.byLevel.Junior} · Middle {summary.byLevel.Middle} · Senior{" "}
              {summary.byLevel.Senior}
            </span>
          </div>

          {plan.fileErrors.length > 0 ? (
            <ul className={styles.issues}>
              {plan.fileErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}

          {missingCategories.length > 0 ? (
            <p className={styles.hint}>
              Нет в базе тем: {missingCategories.join(", ")}.{" "}
              {createMissingCategories
                ? "Они будут созданы перед импортом."
                : "Включите создание тем, иначе эти вопросы не сохранятся."}
            </p>
          ) : null}

          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.headRow}>
                  <th>#</th>
                  <th>Вопрос</th>
                  <th>Тема</th>
                  <th>Уровень</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((item) => {
                  const known = existing.has(item.slug);
                  const status = item.payload
                    ? known
                      ? updateExisting
                        ? "будет обновлён"
                        : "уже есть — пропустим"
                      : "будет создан"
                    : item.errors.join("; ");

                  return (
                    <tr key={`${item.index}-${item.slug}`} className={styles.row}>
                      <td className={styles.colIndex}>{item.index}</td>
                      <td>
                        <span className={styles.name}>{item.title}</span>
                        <span className={styles.rowMeta}>{item.slug || "—"}</span>
                      </td>
                      <td>{item.categoryTitle || "—"}</td>
                      <td>{item.level ?? "—"}</td>
                      <td className={item.payload ? styles.statusOk : styles.statusBad}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.footer}>
            {stage === "importing" ? (
              <span className={styles.hint}>
                Загружено {progress} из {validCount}…
              </span>
            ) : null}
            {stage === "done" ? (
              <span className={styles.hint}>
                Готово: {results.filter((result) => result.outcome === "created").length} создано,{" "}
                {results.filter((result) => result.outcome === "updated").length} обновлено,{" "}
                {results.filter((result) => result.outcome === "skipped").length} пропущено,{" "}
                {failedCount} с ошибкой.
              </span>
            ) : null}
            <button
              type="button"
              className={styles.primary}
              disabled={validCount === 0 || stage === "importing"}
              onClick={() => void startImport()}
            >
              {stage === "importing" ? "Загружаем…" : `Загрузить ${validCount} вопросов`}
            </button>
          </div>
        </section>
      ) : null}

      {results.length > 0 ? (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Результат загрузки</h2>
          <ul className={styles.results}>
            {results.map((result) => (
              <li key={`${result.index}-${result.outcome}`} className={styles.resultItem}>
                <span className={result.outcome === "failed" ? styles.statusBad : styles.statusOk}>
                  {OUTCOME_LABELS[result.outcome]}
                </span>
                <span>
                  #{result.index} {result.title}
                </span>
                {result.message ? <span className={styles.rowMeta}>{result.message}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
