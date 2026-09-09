import assert from "node:assert/strict";
import { test } from "node:test";

import { DataParseError, parseDataModule } from "../lib/mjs-data-parser.ts";

test("читает файл вопросов обычного вида", () => {
	const source = `// вопросы по Java
export default {
  professionSlug: "java-developer",
  categories: [{ slug: "jvm", title: "JVM" }],
  questions: [
    {
      t: "Что такое JIT?",
      l: "Middle",
      c: "jvm",
      g: ["jvm", "performance"],
      pop: true,
      s: [{ h: "Ответ", p: ["Компилирует байт-код в машинный."] }],
    },
  ],
};
`;

	const data = parseDataModule(source);
	assert.equal(data.professionSlug, "java-developer");
	assert.equal(data.categories[0].title, "JVM");
	assert.equal(data.questions[0].pop, true);
	assert.deepEqual(data.questions[0].g, ["jvm", "performance"]);
	assert.equal(data.questions[0].s[0].p[0], "Компилирует байт-код в машинный.");
});

// Регресс: проверка «символ начинает имя» использовала sticky-регулярку, и из-за
// сохранённого lastIndex любое true/false/null после других полей ломало разбор.
test("читает true/false/null после строк, чисел и массивов", () => {
	const source = [
		"export default {",
		'  a: "текст",',
		"  b: 42,",
		'  g: ["jvm"],",'.replace('",', '"],'),
		"  pop: true,",
		"  draft: false,",
		"  note: null,",
		"  items: [true, false, null, 1],",
		"}",
	].join("\n");

	const data = parseDataModule(source);
	assert.equal(data.pop, true);
	assert.equal(data.draft, false);
	assert.equal(data.note, null);
	assert.deepEqual(data.items, [true, false, null, 1]);
});

test("понимает шаблонные строки, склейку, висящие запятые и комментарии", () => {
	const source = [
		"export default {",
		"  /* блочный комментарий */",
		"  questions: [",
		"    {",
		"      t: 'Кэш' + ' и ' + 'память',",
		"      n: -1.5,",
		"      code: { lines: [`const a = 1;`, `console.log(a);`] }, // висящая запятая ниже",
		"    },",
		"  ],",
		"}",
	].join("\n");

	const data = parseDataModule(source);
	assert.equal(data.questions[0].t, "Кэш и память");
	assert.equal(data.questions[0].n, -1.5);
	assert.deepEqual(data.questions[0].code.lines, ["const a = 1;", "console.log(a);"]);
});

test("подставляет константы файла и разворачивает через ...", () => {
	const source = `const tags = ["jvm"];
const base = { l: "Junior", c: "jvm" };

export default {
  questions: [{ ...base, t: "Что такое JVM?", g: tags }],
};
`;

	const data = parseDataModule(source);
	assert.equal(data.questions[0].l, "Junior");
	assert.equal(data.questions[0].c, "jvm");
	assert.deepEqual(data.questions[0].g, ["jvm"]);
});

test("не исполняет код: вызовы функций отклоняются", () => {
	assert.throws(() => parseDataModule("export default { questions: build() };"), DataParseError);
});

test("отклоняет обращение к свойствам и подстановки в строках", () => {
	assert.throws(() => parseDataModule("export default { a: process.env };"), DataParseError);
	assert.throws(() => parseDataModule("export default { a: `${1}` };"), DataParseError);
});

test("сообщает о месте ошибки", () => {
	const source = "export default {\n  questions: [\n    { t: ??? },\n  ],\n};\n";
	assert.throws(() => parseDataModule(source), (error) => {
		assert.ok(error instanceof DataParseError);
		assert.match(error.message, /строка 3/);
		return true;
	});
});

test("требует ровно один export default", () => {
	assert.throws(() => parseDataModule("const a = 1;\n"), /export default/);
	assert.throws(
		() => parseDataModule("export default { a: 1 };\nexport default { b: 2 };\n"),
		/больше одного/,
	);
});

test("не позволяет испортить прототип", () => {
	assert.throws(
		() => parseDataModule('export default { "__proto__": { polluted: true } };'),
		DataParseError,
	);
});
