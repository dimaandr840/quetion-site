import { NextResponse } from "next/server";

import { DataParseError, parseDataModule } from "@/lib/mjs-data-parser";

/**
 * Превращает загруженный файл вопросов (`scripts/data/*.mjs`) в JSON.
 *
 * Файл не исполняется: `frontend/lib/mjs-data-parser.ts` читает из него только
 * литералы данных. Раньше здесь был `node:vm`, и CodeQL справедливо помечал это
 * как code injection — исполнять присланный файл на сервере не нужно, чтобы
 * достать из него объект.
 *
 * Почему разбор всё же на сервере, а не в браузере: CSP админки
 * (`frontend/proxy.ts`) не разрешает ни `blob:` в `script-src`, ни
 * `unsafe-eval`, а Node-код с файловой системой и большими строками здесь
 * дешевле, чем тащить парсер в бандл клиента.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERNAL_BASE = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8080/api";

/** Файл вопросов на 100 КБ — норма; всё, что кратно больше, скорее ошибка. */
const MAX_SOURCE_LENGTH = 2_000_000;

function bad(message: string, status = 400) {
	return NextResponse.json({ error: message }, { status });
}

/** Права проверяет бэкенд: у Next нет ни ролей, ни ключа для разбора JWT. */
async function isAdmin(cookie: string): Promise<boolean> {
	try {
		const response = await fetch(`${INTERNAL_BASE}/admin/questions`, {
			headers: { Accept: "application/json", Cookie: cookie },
			cache: "no-store",
			signal: AbortSignal.timeout(10_000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

export async function POST(request: Request) {
	// Ручка принимает файлы, поэтому запрос — только со своей же страницы.
	const origin = request.headers.get("origin");
	const host = request.headers.get("host");
	if (origin && host) {
		try {
			if (new URL(origin).host !== host) return bad("Запрос из другого источника", 403);
		} catch {
			return bad("Некорректный заголовок Origin", 403);
		}
	}

	const cookie = request.headers.get("cookie") ?? "";
	if (!cookie || !(await isAdmin(cookie))) {
		return bad("Нужны права администратора", 403);
	}

	let source: string;
	try {
		const body = (await request.json()) as { source?: unknown };
		source = typeof body.source === "string" ? body.source : "";
	} catch {
		return bad("Тело запроса не является JSON");
	}

	if (!source.trim()) return bad("Файл пустой");
	if (source.length > MAX_SOURCE_LENGTH) {
		return bad(`Файл больше ${Math.round(MAX_SOURCE_LENGTH / 1_000_000)} МБ`);
	}

	let value: unknown;
	try {
		value = parseDataModule(source);
	} catch (error) {
		if (error instanceof DataParseError) {
			return bad(`Файл не удалось прочитать: ${error.message}`);
		}
		return bad("Файл не удалось прочитать");
	}

	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return bad("«export default» должен быть объектом с полем questions");
	}

	// JSON убирает `undefined` из необязательных полей.
	return NextResponse.json(
		{ data: JSON.parse(JSON.stringify(value)) as unknown },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
