/**
 * Разбор файла данных вопросов (`scripts/data/*.mjs`) без исполнения кода.
 *
 * Такой файл — это `export default` с литералами: объекты, массивы, строки,
 * числа и булевы значения. Читаем их напрямую, как JSON с более свободным
 * синтаксисом (кавычки любого вида, комментарии, висящие запятые, ключи без
 * кавычек, склейка строк через `+`, ссылки на объявленные в файле константы).
 *
 * Ничего исполняемого здесь быть не может: вызовы функций, обращения к
 * свойствам, подстановки в шаблонных строках и незнакомые имена приводят к
 * понятной ошибке с номером строки.
 */

export type DataValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| DataValue[]
	| { [key: string]: DataValue };

/** Ошибка разбора: сообщение рассчитано на показ администратору. */
export class DataParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DataParseError";
	}
}

/** Защита от переполнения стека на самоподобных структурах. */
const MAX_DEPTH = 64;

// Sticky-регулярки вызываются только с явно выставленным lastIndex, и конец
// совпадения читается сразу после exec: иначе состояние течёт между вызовами.
const NUMBER_RE = /0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;
const IDENT_RE = /[A-Za-z_$][A-Za-z0-9_$]*/y;
/** Проверка одного символа — без флага `y`, чтобы не зависеть от lastIndex. */
const IDENT_START_RE = /[A-Za-z_$]/;

/** Поля, которые нельзя записывать: присваивание испортило бы прототип. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

class Reader {
	private readonly src: string;
	private readonly scope: Map<string, DataValue>;
	private i = 0;

	constructor(src: string, scope: Map<string, DataValue>) {
		this.src = src;
		this.scope = scope;
	}

	seek(index: number): void {
		this.i = index;
	}

	readValue(depth = 0): DataValue {
		if (depth > MAX_DEPTH) this.fail("слишком глубокая структура данных");
		let left = this.readPrimary(depth);

		// Длинные тексты и куски кода в файлах часто склеены через `+`.
		for (;;) {
			const mark = this.i;
			this.skipTrivia();
			const ch = this.src[this.i];
			const next = this.src[this.i + 1];
			if (ch !== "+" || next === "+" || next === "=") {
				this.i = mark;
				return left;
			}
			this.i += 1;
			const right = this.readPrimary(depth);
			if (typeof left === "number" && typeof right === "number") {
				left = left + right;
			} else if (isScalar(left) && isScalar(right)) {
				left = `${left}${right}`;
			} else {
				this.fail("складывать можно только строки и числа");
			}
		}
	}

	private readPrimary(depth: number): DataValue {
		const ch = this.peek();
		if (ch === undefined) this.fail("файл закончился раньше, чем данные");
		if (ch === "{") return this.readObject(depth + 1);
		if (ch === "[") return this.readArray(depth + 1);
		if (ch === '"' || ch === "'" || ch === "`") return this.readString();
		if (ch === "(") {
			this.i += 1;
			const value = this.readValue(depth);
			this.expect(")");
			return value;
		}
		if (ch === "-" || ch === "+") {
			this.i += 1;
			const value = this.readPrimary(depth);
			if (typeof value !== "number") this.fail("знак применим только к числу");
			return ch === "-" ? -value : value;
		}
		if (ch === "." || (ch >= "0" && ch <= "9")) return this.readNumber();
		if (IDENT_START_RE.test(ch)) return this.readReference();
		this.fail(`неожидаемый символ «${ch}»: ожидаются только данные`);
	}

	private readObject(depth: number): { [key: string]: DataValue } {
		this.expect("{");
		const result: { [key: string]: DataValue } = {};
		for (;;) {
			const ch = this.peek();
			if (ch === undefined) this.fail("незакрытый объект");
			if (ch === "}") {
				this.i += 1;
				return result;
			}
			if (this.src.startsWith("...", this.i)) {
				this.i += 3;
				const spread = this.readValue(depth);
				if (!spread || typeof spread !== "object" || Array.isArray(spread)) {
					this.fail("через «...» в объект можно развернуть только объект");
				}
				for (const [key, value] of Object.entries(spread)) {
					if (!FORBIDDEN_KEYS.has(key)) result[key] = value;
				}
			} else {
				const key = this.readKey();
				this.expect(":");
				const value = this.readValue(depth);
				if (FORBIDDEN_KEYS.has(key)) this.fail(`недопустимое имя поля «${key}»`);
				result[key] = value;
			}
			if (!this.eat(",")) {
				this.expect("}");
				return result;
			}
		}
	}

	private readArray(depth: number): DataValue[] {
		this.expect("[");
		const result: DataValue[] = [];
		for (;;) {
			const ch = this.peek();
			if (ch === undefined) this.fail("незакрытый массив");
			if (ch === "]") {
				this.i += 1;
				return result;
			}
			if (this.src.startsWith("...", this.i)) {
				this.i += 3;
				const spread = this.readValue(depth);
				if (!Array.isArray(spread)) {
					this.fail("через «...» в массив можно развернуть только массив");
				}
				result.push(...spread);
			} else {
				result.push(this.readValue(depth));
			}
			if (!this.eat(",")) {
				this.expect("]");
				return result;
			}
		}
	}

	private readKey(): string {
		const ch = this.peek();
		if (ch === undefined) this.fail("ожидается имя поля");
		if (ch === '"' || ch === "'" || ch === "`") return this.readString();
		if (ch >= "0" && ch <= "9") return String(this.readNumber());
		if (ch === "[") this.fail("вычисляемые имена полей недопустимы");
		IDENT_RE.lastIndex = this.i;
		const match = IDENT_RE.exec(this.src);
		if (!match) this.fail(`ожидается имя поля, а не «${ch}»`);
		this.i = IDENT_RE.lastIndex;
		return match[0];
	}

	private readNumber(): number {
		NUMBER_RE.lastIndex = this.i;
		const match = NUMBER_RE.exec(this.src);
		if (!match) this.fail("некорректное число");
		const end = NUMBER_RE.lastIndex;
		const value = Number(match[0]);
		if (!Number.isFinite(value)) this.fail(`некорректное число «${match[0]}»`);
		this.i = end;
		return value;
	}

	/** Имена: `true`/`false`/`null`/`undefined` и константы самого файла. */
	private readReference(): DataValue {
		const start = this.i;
		IDENT_RE.lastIndex = this.i;
		const match = IDENT_RE.exec(this.src);
		if (!match) this.fail("ожидается значение");
		const end = IDENT_RE.lastIndex;
		this.i = end;
		const name = match[0];

		if (name === "true") return true;
		if (name === "false") return false;
		if (name === "null") return null;
		if (name === "undefined") return undefined;

		this.skipTrivia();
		const next = this.src[this.i];
		if (next === "(" || next === "." || next === "[") {
			this.i = start;
			if (next === "(") this.fail(`вызов «${name}(…)» недопустим: нужны готовые данные`);
			this.fail(`обращение к свойствам «${name}» недопустимо: нужны готовые данные`);
		}
		if (!this.scope.has(name)) {
			this.i = start;
			this.fail(`неизвестное значение «${name}»: данные должны быть записаны литералами`);
		}
		this.i = end;
		return this.scope.get(name);
	}

	private readString(): string {
		const quote = this.src[this.i];
		this.i += 1;
		let out = "";
		for (;;) {
			const ch = this.src[this.i];
			if (ch === undefined) this.fail("незакрытая строка");
			if (ch === quote) {
				this.i += 1;
				return out;
			}
			if (ch === "\n" && quote !== "`") this.fail("незакрытая строка");
			if (ch === "$" && quote === "`" && this.src[this.i + 1] === "{") {
				this.fail("подстановки ${…} в строках не поддерживаются");
			}
			if (ch === "\\") {
				out += this.readEscape();
				continue;
			}
			out += ch;
			this.i += 1;
		}
	}

	private readEscape(): string {
		this.i += 1;
		const ch = this.src[this.i];
		if (ch === undefined) this.fail("незакрытая строка");
		this.i += 1;
		switch (ch) {
			case "n":
				return "\n";
			case "t":
				return "\t";
			case "r":
				return "\r";
			case "b":
				return "\b";
			case "f":
				return "\f";
			case "v":
				return "\v";
			case "0":
				return "\0";
			case "\n":
				return "";
			case "\r":
				if (this.src[this.i] === "\n") this.i += 1;
				return "";
			case "x": {
				const hex = this.src.slice(this.i, this.i + 2);
				if (!/^[0-9a-fA-F]{2}$/.test(hex)) this.fail("некорректная последовательность \\x");
				this.i += 2;
				return String.fromCharCode(Number.parseInt(hex, 16));
			}
			case "u": {
				if (this.src[this.i] === "{") {
					const end = this.src.indexOf("}", this.i);
					const hex = end === -1 ? "" : this.src.slice(this.i + 1, end);
					if (!/^[0-9a-fA-F]{1,6}$/.test(hex)) this.fail("некорректная последовательность \\u");
					this.i = end + 1;
					return String.fromCodePoint(Number.parseInt(hex, 16));
				}
				const hex = this.src.slice(this.i, this.i + 4);
				if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("некорректная последовательность \\u");
				this.i += 4;
				return String.fromCharCode(Number.parseInt(hex, 16));
			}
			default:
				// \\ \' \" \` и прочее — символ как есть.
				return ch;
		}
	}

	private skipTrivia(): void {
		for (;;) {
			const ch = this.src[this.i];
			if (ch === undefined) return;
			if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\u00a0" || ch === "\ufeff") {
				this.i += 1;
				continue;
			}
			if (ch === "/" && this.src[this.i + 1] === "/") {
				const end = this.src.indexOf("\n", this.i);
				this.i = end === -1 ? this.src.length : end + 1;
				continue;
			}
			if (ch === "/" && this.src[this.i + 1] === "*") {
				const end = this.src.indexOf("*/", this.i + 2);
				if (end === -1) this.fail("незакрытый комментарий");
				this.i = end + 2;
				continue;
			}
			return;
		}
	}

	private peek(): string | undefined {
		this.skipTrivia();
		return this.src[this.i];
	}

	private eat(ch: string): boolean {
		if (this.peek() !== ch) return false;
		this.i += 1;
		return true;
	}

	private expect(ch: string): void {
		if (!this.eat(ch)) {
			const found = this.src[this.i] ?? "конец файла";
			this.fail(`ожидается «${ch}», а не «${found}»`);
		}
	}

	private fail(message: string): never {
		const before = this.src.slice(0, this.i);
		const line = before.split("\n").length;
		const column = this.i - before.lastIndexOf("\n");
		throw new DataParseError(`${message} (строка ${line}, символ ${column})`);
	}
}

function isScalar(value: DataValue): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

const DECLARATION_RE = /(?:^|[\n;])[ \t]*(?:export[ \t]+)?(?:const|let|var)[ \t]+([A-Za-z_$][A-Za-z0-9_$]*)[ \t]*=/g;
const DEFAULT_EXPORT_RE = /(?:^|[\n;])[ \t]*export[ \t]+default\b\s*/g;

/**
 * Читает данные из файла вопросов.
 *
 * @throws {DataParseError} если в файле нет `export default` или встретилось
 * что-то кроме литералов данных.
 */
export function parseDataModule(source: string): DataValue {
	// Константы файла: нужны, если данные разложены по нескольким переменным.
	// Объявление, которое не разбирается как литерал, просто пропускается —
	// ошибка появится только при попытке им воспользоваться.
	const scope = new Map<string, DataValue>();
	DECLARATION_RE.lastIndex = 0;
	for (let match = DECLARATION_RE.exec(source); match; match = DECLARATION_RE.exec(source)) {
		const reader = new Reader(source, scope);
		reader.seek(match.index + match[0].length);
		try {
			scope.set(match[1], reader.readValue());
		} catch {
			scope.delete(match[1]);
		}
	}

	DEFAULT_EXPORT_RE.lastIndex = 0;
	const first = DEFAULT_EXPORT_RE.exec(source);
	if (!first) throw new DataParseError("в файле нет «export default» с данными");
	if (DEFAULT_EXPORT_RE.exec(source)) {
		throw new DataParseError("в файле больше одного «export default»");
	}

	const reader = new Reader(source, scope);
	reader.seek(first.index + first[0].length);
	return reader.readValue();
}
