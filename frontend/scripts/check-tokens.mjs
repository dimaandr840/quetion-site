#!/usr/bin/env node
/**
 * Ратчет против легаси-токенов дизайн-системы.
 *
 * Полное удаление старых имён (--radius-4…16, --font-outfit, --font-dm-sans,
 * --font-jetbrains-mono) сломало бы уже написанные компоненты, поэтому в
 * tokens.css они остались алиасами канонических токенов. Проблема алиасов в
 * том, что они не мешают писать новый код по-старому — и оба набора живут
 * годами.
 *
 * Скрипт не требует зависимостей (значит, `npm ci` и Docker-сборка не
 * меняются) и работает как ратчет:
 *   • первый запуск фиксирует текущий долг в scripts/token-debt.json;
 *   • дальше сборка падает, если долг вырос;
 *   • когда долг уменьшился, скрипт предлагает обновить baseline.
 *
 * Запуск: npm run check:tokens        (из папки frontend)
 *         npm run check:tokens -- --update-baseline
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "styles"];
const SCAN_EXTENSIONS = [".css", ".ts", ".tsx"];
const BASELINE_PATH = join(ROOT, "scripts", "token-debt.json");

/* tokens.css — единственное место, где легаси-имена объявлены сознательно. */
const IGNORED_FILES = new Set([join("styles", "tokens.css")]);

const DEPRECATED_TOKENS = [
  "--radius-4",
  "--radius-6",
  "--radius-8",
  "--radius-12",
  "--radius-16",
  "--font-outfit",
  "--font-dm-sans",
  "--font-jetbrains-mono",
];

const REPLACEMENTS = {
  "--radius-4": "--radius-inset",
  "--radius-6": "--radius-inset",
  "--radius-8": "--radius-control",
  "--radius-12": "--radius-surface",
  "--radius-16": "--radius-surface",
  "--font-outfit": "--font-display",
  "--font-dm-sans": "--font-sans",
  "--font-jetbrains-mono": "--font-mono",
};

function collectFiles(dir) {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];

  const found = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectFiles(entryPath));
      continue;
    }
    if (!SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
    if (IGNORED_FILES.has(entryPath)) continue;
    found.push(entryPath);
  }
  return found;
}

function scan() {
  const perToken = Object.fromEntries(DEPRECATED_TOKENS.map((t) => [t, 0]));
  const hits = [];

  for (const dir of SCAN_DIRS) {
    for (const file of collectFiles(dir)) {
      const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const token of DEPRECATED_TOKENS) {
          /* Границей считаем не-идентификаторный символ, иначе --radius-1
             матчился бы внутри --radius-12 и --radius-16. */
          const pattern = new RegExp(`${token}(?![\\w-])`, "g");
          const count = (line.match(pattern) ?? []).length;
          if (count === 0) continue;
          perToken[token] += count;
          hits.push({
            file: file.split(sep).join("/"),
            line: index + 1,
            token,
          });
        }
      });
    }
  }

  const total = Object.values(perToken).reduce((sum, n) => sum + n, 0);
  return { total, perToken, hits };
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error(
      `check-tokens: ${relative(ROOT, BASELINE_PATH)} повреждён — удалите файл и запустите скрипт заново.`
    );
    process.exit(1);
  }
}

function writeBaseline(result) {
  const payload = {
    comment:
      "Долг по легаси-токенам. Число может только уменьшаться. Обновить: npm run check:tokens -- --update-baseline",
    total: result.total,
    perToken: result.perToken,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function printHits(hits, limit = 25) {
  for (const hit of hits.slice(0, limit)) {
    const replacement = REPLACEMENTS[hit.token];
    console.error(
      `  ${hit.file}:${hit.line}  ${hit.token} → ${replacement}`
    );
  }
  if (hits.length > limit) {
    console.error(`  … и ещё ${hits.length - limit}`);
  }
}

const result = scan();
const baseline = readBaseline();
const shouldUpdate = process.argv.includes("--update-baseline");

if (!baseline || shouldUpdate) {
  writeBaseline(result);
  console.log(
    `check-tokens: baseline зафиксирован — ${result.total} обращений к легаси-токенам.`
  );
  console.log(
    "Закоммитьте scripts/token-debt.json: дальше число может только уменьшаться."
  );
  if (result.total > 0) printHits(result.hits);
  process.exit(0);
}

const grown = DEPRECATED_TOKENS.filter(
  (token) => result.perToken[token] > (baseline.perToken?.[token] ?? 0)
);

if (grown.length > 0) {
  console.error("check-tokens: долг по легаси-токенам вырос.\n");
  for (const token of grown) {
    const before = baseline.perToken?.[token] ?? 0;
    console.error(
      `  ${token}: было ${before}, стало ${result.perToken[token]} → используйте ${REPLACEMENTS[token]}`
    );
  }
  console.error("\nВсе обращения:");
  printHits(result.hits.filter((hit) => grown.includes(hit.token)));
  process.exit(1);
}

if (result.total < baseline.total) {
  console.log(
    `check-tokens: долг снизился ${baseline.total} → ${result.total}. Зафиксируйте: npm run check:tokens -- --update-baseline`
  );
  process.exit(0);
}

console.log(`check-tokens: без регрессий (${result.total} обращений).`);
