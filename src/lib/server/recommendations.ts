import { randomUUID } from 'node:crypto';
import { and, eq, gte } from 'drizzle-orm';
import { db } from './db';
import { comments, likes, subscriptions, videos, watchHistory } from './db/schema';

const DAY = 86_400_000;

/** Новый seed на каждый запрос — лента слегка переставляется при перезагрузке. */
export function newSeed(): string {
	return randomUUID();
}

export type RankedVideo = {
	id: string;
	title: string;
	description: string | null;
	thumbnail: string | null;
	viewCount: number;
	likeCount: number;
	dislikeCount: number;
	commentCount: number;
	category: string | null;
	tags: string[] | null;
	publishedAt: Date | string;
	createdAt: Date | string;
	duration: number;
	isShort: boolean;
	userId: string;
};

export type RankedAuthor = {
	id: string;
	banner?: string | null;
	verified?: boolean;
	creator?: boolean;
	bannedUntil?: Date | string | null;
};

export type RankCandidate = { video: RankedVideo; author: RankedAuthor };

export type ViewerSignals = {
	subscribed: Set<string>;
	likedAuthors: Set<string>;
	watchedAuthors: Set<string>;
	likedCategories: Map<string, number>;
	watchedCategories: Map<string, number>;
	likedTags: Map<string, number>;
	watchedTags: Map<string, number>;
	watchedVideos: Set<string>;
	completedVideos: Set<string>;
	recentActivity: Map<string, number>;
};

function emptySignals(): ViewerSignals {
	return {
		subscribed: new Set(),
		likedAuthors: new Set(),
		watchedAuthors: new Set(),
		likedCategories: new Map(),
		watchedCategories: new Map(),
		likedTags: new Map(),
		watchedTags: new Map(),
		watchedVideos: new Set(),
		completedVideos: new Set(),
		recentActivity: new Map()
	};
}

function bump(map: Map<string, number>, key: string | null | undefined, weight: number) {
	if (!key) return;
	map.set(key, (map.get(key) ?? 0) + weight);
}

function tagsOf(value: string[] | null): string[] {
	return (value ?? []).map((tag) => tag.toLowerCase().trim()).filter(Boolean);
}

/** Собирает персональные сигналы: подписки, лайки, история просмотров и свежая активность. */
export async function getViewerSignals(userId?: string | null): Promise<ViewerSignals> {
	const signals = emptySignals();
	const since = new Date(Date.now() - 7 * DAY);

	const [likedRows, watchedRows, subscribedRows, recentLikes, recentComments] = await Promise.all([
		userId
			? db
					.select({
						videoId: likes.videoId,
						authorId: videos.userId,
						category: videos.category,
						tags: videos.tags
					})
					.from(likes)
					.innerJoin(videos, eq(likes.videoId, videos.id))
					.where(and(eq(likes.userId, userId), eq(likes.type, 1)))
			: Promise.resolve([]),
		userId
			? db
					.select({
						videoId: watchHistory.videoId,
						authorId: videos.userId,
						category: videos.category,
						tags: videos.tags,
						progress: watchHistory.progress,
						completed: watchHistory.completed,
						updatedAt: watchHistory.updatedAt
					})
					.from(watchHistory)
					.innerJoin(videos, eq(watchHistory.videoId, videos.id))
					.where(eq(watchHistory.userId, userId))
			: Promise.resolve([]),
		userId
			? db.select({ channelId: subscriptions.channelId }).from(subscriptions).where(eq(subscriptions.subscriberId, userId))
			: Promise.resolve([]),
		db.select({ videoId: likes.videoId }).from(likes).where(gte(likes.createdAt, since)),
		db.select({ videoId: comments.videoId }).from(comments).where(gte(comments.createdAt, since))
	]);

	for (const row of likedRows) {
		signals.likedAuthors.add(row.authorId);
		bump(signals.likedCategories, row.category, 1);
		for (const tag of tagsOf(row.tags)) bump(signals.likedTags, tag, 1);
	}

	for (const row of watchedRows) {
		const ageDays = Math.max(0, (Date.now() - new Date(row.updatedAt).getTime()) / DAY);
		const weight = Math.max(0.25, 1 / (1 + ageDays / 21));
		signals.watchedVideos.add(row.videoId);
		if (row.completed) signals.completedVideos.add(row.videoId);
		signals.watchedAuthors.add(row.authorId);
		bump(signals.watchedCategories, row.category, weight);
		for (const tag of tagsOf(row.tags)) bump(signals.watchedTags, tag, weight);
	}

	for (const row of subscribedRows) signals.subscribed.add(row.channelId);
	for (const row of recentLikes) bump(signals.recentActivity, row.videoId, 1);
	for (const row of recentComments) bump(signals.recentActivity, row.videoId, 1.5);

	return signals;
}

/** Детерминированный хэш [0,1) — используется для «перестановки» ленты по seed. */
function hashUnit(seed: string, key: string, salt = 0): number {
	let hash = 2166136261 >>> 0;
	const input = `${seed}|${salt}|${key}`;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 4_294_967_296;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/**
 * База рейтинга. Чем выше балл, тем выше видео в рекомендациях.
 * Видео без баннера не отсекается — оно получает штраф и поэтому появляется редко.
 */
export function scoreCandidate(candidate: RankCandidate, signals: ViewerSignals, seed: string, now = Date.now()): number {
	const { video, author } = candidate;
	const views = Math.max(0, video.viewCount);
	const likes = Math.max(0, video.likeCount);
	const dislikes = Math.max(0, video.dislikeCount ?? 0);
	const commentCount = Math.max(0, video.commentCount ?? 0);
	const likeRate = likes / Math.max(1, views);
	const dislikeRate = dislikes / Math.max(1, views);

	const timestamp = new Date(video.publishedAt ?? video.createdAt).getTime();
	const ageDays = Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / DAY) : 30;
	const freshness = 14 * Math.exp(-ageDays / 12);
	const popularity = 7 * (Math.log10(1 + views) / 4);
	const approval = 10 * clamp(likeRate / 0.08, 1);
	const discussion = 4 * clamp(Math.log2(1 + commentCount) / 6, 1);
	const activity = 4 * clamp((signals.recentActivity.get(video.id) ?? 0) / 5, 1);

	let score = 8 + freshness + popularity + approval + discussion + activity;

	// Качество самого ролика
	if (video.thumbnail) score += 2;
	if ((video.description ?? '').trim().length > 40) score += 1.5;
	if (tagsOf(video.tags).length >= 2) score += 1.5;
	const hashtags = (video.description ?? '').match(/#[\p{L}\p{N}_]{2,30}/gu) ?? [];
	score += clamp(hashtags.length * 1.5, 6);
	if (video.duration >= 60) score += 1;
	if (video.title.trim().length < 5) score -= 4;

	// Баннер канала важен для обычных видео. Для Shorts он не требуется вовсе.
	if (!video.isShort) {
		if ((author.banner ?? '').trim()) score += 9;
		else {
			score -= 5;
			score *= 0.72;
		}
	}
	if (author.verified) score += 2.5;
	if (author.creator) score += 1.5;
	if (author.bannedUntil && new Date(author.bannedUntil).getTime() > now) score -= 25;

	// Персонализация
	if (signals.subscribed.has(video.userId)) score += 7;
	if (signals.likedAuthors.has(video.userId)) score += 5;
	if (signals.watchedAuthors.has(video.userId)) score += 3.5;
	score += clamp((signals.likedCategories.get(video.category ?? '') ?? 0) * 1.5, 6);
	score += clamp((signals.watchedCategories.get(video.category ?? '') ?? 0) * 1.2, 5);

	let tagAffinity = 0;
	for (const tag of [...tagsOf(video.tags), ...hashtags.map((tag) => tag.slice(1).toLowerCase())]) {
		tagAffinity += (signals.likedTags.get(tag) ?? 0) * 1.2;
		tagAffinity += (signals.watchedTags.get(tag) ?? 0) * 0.8;
	}
	score += clamp(tagAffinity, 6);

	if (signals.watchedVideos.has(video.id)) score -= 6;
	if (signals.completedVideos.has(video.id)) score -= 2;
	score -= 8 * clamp(dislikeRate / 0.06, 1);

	// Разброс: между перезагрузками порядок меняется, но качество остаётся главным
	score += (hashUnit(seed, video.id, 1) - 0.5) * 16;

	return score;
}

export type RankOptions = { limit?: number; boostCategory?: string | null };

export function rankCandidates<T extends RankCandidate>(
	candidates: T[],
	signals: ViewerSignals,
	seed: string,
	options: RankOptions = {}
): T[] {
	const now = Date.now();
	const scored = candidates.map((candidate, index) => {
		let score = scoreCandidate(candidate, signals, seed, now);
		if (options.boostCategory && candidate.video.category === options.boostCategory) score += 6;
		return { candidate, index, score, tie: hashUnit(seed, candidate.video.id, 2) };
	});

	scored.sort((a, b) => b.score - a.score || a.tie - b.tie || a.index - b.index);
	const ranked = options.limit ? scored.slice(0, options.limit) : scored;
	return ranked.map((item) => item.candidate);
}
