/** Русское склонение числительных: 1 вопрос, 2 вопроса, 5 вопросов. */
export function pluralize(
  count: number,
  forms: [one: string, few: string, many: string]
): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return `${count} ${forms[2]}`;
  if (last > 1 && last < 5) return `${count} ${forms[1]}`;
  if (last === 1) return `${count} ${forms[0]}`;
  return `${count} ${forms[2]}`;
}

export function pluralizeQuestions(count: number): string {
  return pluralize(count, ["вопрос", "вопроса", "вопросов"]);
}

export function pluralizeCategories(count: number): string {
  return pluralize(count, ["категория", "категории", "категорий"]);
}

export function pluralizeTopics(count: number): string {
  return pluralize(count, ["тема", "темы", "тем"]);
}

export function pluralizeTasks(count: number): string {
  return pluralize(count, ["задание", "задания", "заданий"]);
}

export function pluralizeDirections(count: number): string {
  return pluralize(count, ["направлению", "направлениям", "направлениям"]);
}
