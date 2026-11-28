/**
 * Проверка текстов на ссылки/контакты. Используется и на клиенте, и на сервере:
 * до 50 подписчиков любые ссылки в контенте запрещены.
 */

const OBFUSCATED: [RegExp, string][] = [
	[/\[\s*\.?\s*\]|\(\s*dot\s*\)|\{\s*\.?\s*\}/gi, '.'],
	[/\s+(?:dot|точка)\s+/gi, '.'],
	[/\s+at\s+/gi, '@'],
	[/hxxps?:\/\//gi, 'http']
];

function normalize(text: string): string {
	return OBFUSCATED.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

const PATTERNS: RegExp[] = [
	/\b(?:https?|ftp|hxxps?):\/\/\S+/gi,
	/\bwww\.[^\s]+\.[a-z]{2,}\b/gi,
	/\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#][^\s]*)?\b/gi,
	/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi,
	/\bt\.me\/\S+|\btelegram\.me\/\S+|\bdiscord\.gg\/\S+|\bwa\.me\/\S+/gi,
	/\b(?:vk|ok|instagram|facebook|youtube|twitter|x|tiktok)\.com\/[^\s]+/gi
];

/** Возвращает все найденные ссылки/контакты в тексте. */
export function findLinks(text: string): string[] {
	if (!text) return [];
	const normalized = normalize(text);
	const found = new Set<string>();
	for (const pattern of PATTERNS) {
		for (const match of normalized.matchAll(pattern)) {
			const value = match[0].trim();
			if (value.length >= 4) found.add(value);
		}
	}
	return [...found];
}

export function hasLink(text: string): boolean {
	return findLinks(text).length > 0;
}

export const LINKS_MIN_SUBSCRIBERS = 50;
