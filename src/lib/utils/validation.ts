export const NAME_COOLDOWN_DAYS = 7;
export const USERNAME_COOLDOWN_DAYS = 30;

const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{200D}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;
const NAME_RE = /^[\p{L}\p{N} -]+$/u;
const USERNAME_RE = /^[^\s/\\]+$/u;
const TITLE_RE = /^[\p{L}\p{N} .,!?:;()\-–—'"]+$/u;

export function hasEmoji(value: string): boolean {
	EMOJI.lastIndex = 0;
	return EMOJI.test(value);
}

export function cleanText(value: string): string {
	return value
		.replace(EMOJI, '')
		.replace(/[\u0000-\u001F\u007F]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Для описаний: сохраняет переводы строк и пустые строки (абзацы). */
export function cleanMultilineText(value: string): string {
	return value
		.replace(EMOJI, '')
		.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
		.replace(/[^\S\n]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function validateNickname(value: string): string | null {
	const clean = cleanText(value);
	if (clean.length < 3) return 'Никнейм минимум 3 символа';
	if (clean.length > 24) return 'Никнейм максимум 24 символа';
	if (!NAME_RE.test(clean)) return 'В никнейме можно использовать только буквы, цифры, пробел и дефис';
	return null;
}

export function validateUsername(value: string): string | null {
	const clean = value.trim().replace(/^@/, '');
	if (clean.length < 3) return 'Юзернейм минимум 3 символа';
	if (clean.length > 20) return 'Юзернейм максимум 20 символов';
	if (!USERNAME_RE.test(clean)) return 'Юзернейм не должен содержать пробелы и слеши';
	return null;
}

export function validateTitle(value: string): string | null {
	const clean = cleanText(value);
	if (!clean) return 'Название не может быть пустым';
	if (clean.length > 120) return 'Название слишком длинное';
	if (!TITLE_RE.test(clean)) return 'В названии нельзя использовать эмодзи и специальные символы';
	return null;
}

export function validateUserText(value: string): string | null {
	if (hasEmoji(value)) return 'Эмодзи запрещены';
	if (/[\u0000-\u001F\u007F]/.test(value.replace(/\n/g, ''))) return 'Недопустимые символы';
	return null;
}

export function daysLeft(changedAt: Date | null | undefined, days: number): number {
	if (!changedAt) return 0;
	const elapsed = Date.now() - new Date(changedAt).getTime();
	const left = days - Math.floor(elapsed / 86_400_000);
	return left > 0 ? left : 0;
}
