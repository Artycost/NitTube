const compact = new Intl.NumberFormat('ru-RU', {
	notation: 'compact',
	maximumFractionDigits: 1
});

const number = new Intl.NumberFormat('ru-RU');

export function formatCompact(value: number): string {
	if (value < 1000) return number.format(value);
	return compact.format(value).replace('.', ',');
}

export function plural(n: number, forms: [string, string, string]): string {
	const abs = Math.abs(n) % 100;
	const last = abs % 10;
	if (abs > 10 && abs < 20) return forms[2];
	if (last > 1 && last < 5) return forms[1];
	if (last === 1) return forms[0];
	return forms[2];
}

export function formatViews(n: number): string {
	return `${formatCompact(n)} ${plural(n, ['просмотр', 'просмотра', 'просмотров'])}`;
}

export function formatSubscribers(n: number): string {
	return `${formatCompact(n)} ${plural(n, ['подписчик', 'подписчика', 'подписчиков'])}`;
}

export function formatVideos(n: number): string {
	return `${formatCompact(n)} ${plural(n, ['видео', 'видео', 'видео'])}`;
}

export function formatDuration(totalSeconds: number): string {
	if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
	const seconds = Math.floor(totalSeconds % 60);
	const minutes = Math.floor((totalSeconds / 60) % 60);
	const hours = Math.floor(totalSeconds / 3600);
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

export function timeAgo(input: Date | number | string): string {
	const date = input instanceof Date ? input : new Date(input);
	const seconds = Math.round((date.getTime() - Date.now()) / 1000);
	const abs = Math.abs(seconds);

	if (abs < 60) return 'только что';
	if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
	if (abs < 2592000) return rtf.format(Math.round(seconds / 86400), 'day');
	if (abs < 31536000) return rtf.format(Math.round(seconds / 2592000), 'month');
	return rtf.format(Math.round(seconds / 31536000), 'year');
}

export function formatDate(input: Date | number | string): string {
	const date = input instanceof Date ? input : new Date(input);
	return new Intl.DateTimeFormat('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(date);
}

export function formatDateShort(input: Date | number | string): string {
	const date = input instanceof Date ? input : new Date(input);
	return new Intl.DateTimeFormat('ru-RU', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[1][0]).toUpperCase();
}

const palettes = [
	'#3f3f46',
	'#52525b',
	'#71717a',
	'#a1a1aa',
	'#27272a',
	'#5b5b66',
	'#3f3f46',
	'#6b6b75'
];

export function colorFor(seed: string): string {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return palettes[hash % palettes.length];
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
