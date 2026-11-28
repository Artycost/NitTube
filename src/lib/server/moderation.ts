import { eq } from 'drizzle-orm';
import { db } from './db';
import { user } from './db/schema';

const boundary = (words: string[]) =>
	words.map((w) => `(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`).join('|');

const patterns: { reason: string; re: RegExp }[] = [
	{
		reason: '18+ / сексуальный контент',
		re: new RegExp(
			boundary([
				'18\\+', '18\\s?плюс', 'порно', 'порнуха', 'эротика', 'нude', 'nudes', 'nsfw', 'xxx',
				'секс', 'сексуальный', 'оргазм', 'мастурбац\\w*', 'эякуляц\\w*', 'голые', 'обнаженн\\w*',
				'нецензурн\\w*', 'over\\s?18', 'adult\\s?content', 'эротичн\\w*'
			]),
			'iu'
		)
	},
	{
		reason: 'Шок / насилие / убийство',
		re: new RegExp(
			boundary([
				'убийств\\w*', 'убить', 'убийца', 'убиваю', 'убийство', 'death', 'kill(?:ing|ed|er)?',
				'murder', 'gore', 'шок\\w*', 'шоков\\w*', 'труп\\w*', 'кровь',
				'кровав\\w*', 'резня', 'бойня', 'самоубийств\\w*', 'суицид\\w*', 'повешени\\w*',
				'обезглавл\\w*', 'расчлен\\w*', 'изнасилован\\w*', 'насилие', 'издевательств\\w*',
				'пытк\\w*', 'жесток\\w*', 'смерть', 'смертельный', 'травм\\w*', 'авария', 'аварии',
				'крива\\w*', 'реанимаци\\w*', 'beat\\s?up', 'brutal'
			]),
			'iu'
		)
	}
];

export function moderateText(...parts: (string | null | undefined)[]) {
	const text = parts.filter(Boolean).join(' \n ').toLowerCase();
	for (const pattern of patterns) {
		if (pattern.re.test(text)) return { blocked: true, reason: pattern.reason };
	}
	return { blocked: false, reason: '' };
}

export async function isBanned(userId: string): Promise<{ banned: boolean; daysLeft: number; reason: string }> {
	const [row] = await db
		.select({ bannedUntil: user.bannedUntil, banReason: user.banReason })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!row?.bannedUntil) return { banned: false, daysLeft: 0, reason: '' };
	const ms = new Date(row.bannedUntil).getTime() - Date.now();
	if (ms <= 0) return { banned: false, daysLeft: 0, reason: '' };
	return {
		banned: true,
		daysLeft: Math.ceil(ms / 86_400_000),
		reason: row.banReason ?? 'Нарушение правил сообщества'
	};
}

export async function banFor7Days(userId: string, reason: string) {
	const until = new Date(Date.now() + 7 * 86_400_000);
	await db.update(user).set({ bannedUntil: until, banReason: reason }).where(eq(user.id, userId));
	return until;
}

export async function unbanExpired(userId: string) {
	const status = await isBanned(userId);
	if (!status.banned) {
		await db.update(user).set({ bannedUntil: null, banReason: null }).where(eq(user.id, userId));
	}
}
