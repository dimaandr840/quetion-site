import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const { industries, professions, specializations, categories, questions } = await import(
  pathToFileURL(resolve(root, "frontend/lib/content.ts")).href
);

const LEVELS = ["Junior", "Middle", "Senior"];

// Счётчики считаем по реальным вопросам: выдуманные числа в интерфейсе недопустимы.
const countFor = (predicate) => questions.filter(predicate).length;

const seed = {
  industries: industries.map((i, index) => ({ ...i, sortOrder: index })),
  professions: professions.map((p, index) => ({
    ...p,
    featured: Boolean(p.featured),
    questionCount: countFor((q) => q.professionSlug === p.slug),
    levelCounts: Object.fromEntries(
      LEVELS.map((level) => [
        level,
        countFor((q) => q.professionSlug === p.slug && q.level === level),
      ])
    ),
    sortOrder: index,
  })),
  specializations: specializations.map((s, index) => ({ ...s, sortOrder: index })),
  categories: categories.map((c, index) => ({
    ...c,
    questionCount: countFor(
      (q) => q.professionSlug === c.professionSlug && q.categorySlug === c.slug
    ),
    sortOrder: index,
  })),
  questions: questions.map((q) => ({
    ...q,
    popular: Boolean(q.popular),
    sections: q.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      paragraphs: s.paragraphs ?? [],
      bullets: s.bullets ?? [],
      code: s.code ?? null,
    })),
    tasks: (q.tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      statement: t.statement ?? [],
      hint: t.hint ?? null,
    })),
  })),
};

const target = resolve(root, "backend/src/main/resources/seed/content.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(seed, null, 2) + "\n", "utf8");

const taskCount = seed.questions.reduce((sum, q) => sum + q.tasks.length, 0);
console.log(
  `industries=${seed.industries.length} professions=${seed.professions.length} ` +
    `specializations=${seed.specializations.length} categories=${seed.categories.length} ` +
    `questions=${seed.questions.length} tasks=${taskCount} -> ${target}`
);
