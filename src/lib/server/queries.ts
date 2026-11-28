import { db } from './db';
import { comments, commentLikes, likes, streams, subscriptions, user, videos, watchHistory } from './db/schema';
import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { Author, ChannelSummary, CommentData, VideoCardData } from '#lib/types';
import { getViewerSignals, rankCandidates } from './recommendations';

const authorColumns = {
	id: user.id,
	name: user.name,
	image: user.image,
	verified: user.verified,
	creator: user.creator,
	banner: user.banner,
	bannedUntil: user.bannedUntil
};

const videoColumns = {
	id: videos.id,
	title: videos.title,
	description: videos.description,
	thumbnail: videos.thumbnail,
	videoUrl: videos.videoUrl,
	duration: videos.duration,
	viewCount: videos.viewCount,
	likeCount: videos.likeCount,
	dislikeCount: videos.dislikeCount,
	commentCount: videos.commentCount,
	createdAt: videos.createdAt,
	publishedAt: videos.publishedAt,
	tags: videos.tags,
	category: videos.category,
	visibility: videos.visibility,
	isShort: videos.isShort,
	hasMusic: videos.hasMusic,
	userId: videos.userId
};

export type FeedVideo = VideoCardData & {
	category: string | null;
	visibility: string;
	likeCount: number;
	commentCount: number;
	isShort: boolean;
	userId: string;
};

type VideoRow = {
	video: {
		id: string;
		title: string;
		description: string | null;
		thumbnail: string | null;
		videoUrl: string;
		duration: number;
		viewCount: number;
		likeCount: number;
		dislikeCount: number;
		commentCount: number;
		createdAt: Date;
		publishedAt: Date;
		tags: string[] | null;
		category: string | null;
		visibility: string;
		isShort: boolean;
		hasMusic: boolean;
		userId: string;
	};
	author: Author & { banner: string | null; bannedUntil: Date | null };
};

function mapVideo(row: VideoRow, progress = 0): FeedVideo {
	return {
		...row.video,
		user: row.author,
		progress
	};
}

export async function getFeed(category?: string, viewerId?: string | null, seed?: string): Promise<FeedVideo[]> {
	// Shorts показываются отдельной полкой и не дублируются в сетке рекомендаций.
	const conditions = [eq(videos.visibility, 'public'), ne(videos.copyrightStatus, 'claimed'), or(eq(videos.isShort, false), isNull(videos.isShort))];
	if (category && category !== 'Все') conditions.push(eq(videos.category, category));

	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(and(...conditions))
		.orderBy(desc(videos.publishedAt))
		.limit(240);

	if (!rows.length) return [];
	const signals = await getViewerSignals(viewerId);
	return rankCandidates(rows, signals, seed ?? 'feed', { limit: 48 }).map((row) => mapVideo(row));
}

export async function getShorts(viewerId?: string | null, seed?: string): Promise<FeedVideo[]> {
	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(and(eq(videos.visibility, 'public'), ne(videos.copyrightStatus, 'claimed'), eq(videos.isShort, true)))
		.orderBy(desc(videos.publishedAt))
		.limit(120);

	if (!rows.length) return [];
	const signals = await getViewerSignals(viewerId);
	return rankCandidates(rows, signals, seed ?? 'shorts', { limit: 30 }).map((row) => mapVideo(row));
}

export async function getTrending(): Promise<FeedVideo[]> {
	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(and(eq(videos.visibility, 'public'), ne(videos.copyrightStatus, 'claimed')))
		.orderBy(desc(videos.viewCount), desc(videos.publishedAt))
		.limit(48);

	return rows.map((row) => mapVideo(row));
}

export async function getVideo(id: string) {
	const [row] = await db
		.select({
			video: videos,
			author: authorColumns
		})
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(eq(videos.id, id))
		.limit(1);

	if (!row) return null;

	const subscriberCount = await getSubscriberCount(row.author.id);

	return {
		...row.video,
		user: row.author,
		subscriberCount
	};
}

export async function getRecommendations(videoId: string, category: string | null, viewerId?: string | null, seed?: string) {
	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(and(eq(videos.visibility, 'public'), ne(videos.copyrightStatus, 'claimed'), ne(videos.id, videoId)))
		.orderBy(desc(videos.publishedAt))
		.limit(96);

	if (!rows.length) return [];
	const signals = await getViewerSignals(viewerId);
	return rankCandidates(rows, signals, seed ?? 'related', { limit: 12, boostCategory: category }).map((row) => mapVideo(row));
}

export async function getLiveStreams(userId?: string): Promise<{ id: string; title: string; category: string; viewers: number; startedAt: Date; userId: string; name: string; image: string | null }[]> {
	const rows = await db
		.select({
			id: streams.id,
			title: streams.title,
			category: streams.category,
			viewers: streams.viewers,
			startedAt: streams.startedAt,
			userId: streams.userId,
			name: user.name,
			image: user.image
		})
		.from(streams)
		.innerJoin(user, eq(streams.userId, user.id))
		.where(userId ? and(eq(streams.isLive, true), eq(streams.userId, userId)) : eq(streams.isLive, true))
		.orderBy(desc(streams.startedAt))
		.limit(12);
	return rows.map((row) => ({
		...row,
		startedAt: (row.startedAt ? new Date(row.startedAt).toISOString() : new Date().toISOString()) as unknown as Date
	}));
}

export async function getChannel(id: string) {
	const [channel] = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			banner: user.banner,
			bio: user.bio,
			verified: user.verified,
			creator: user.creator,
			createdAt: user.createdAt
		})
		.from(user)
		.where(eq(user.id, id))
		.limit(1);
	if (!channel) return null;

	const [stats] = await db
		.select({
			videoCount: sql<number>`count(*)`,
			viewCount: sql<number>`coalesce(sum(${videos.viewCount}), 0)`
		})
		.from(videos)
		.where(and(eq(videos.userId, id), eq(videos.visibility, 'public'), ne(videos.copyrightStatus, 'claimed')));

	const subscriberCount = await getSubscriberCount(id);

	return {
		...channel,
		videoCount: Number(stats?.videoCount ?? 0),
		viewCount: Number(stats?.viewCount ?? 0),
		subscriberCount
	};
}

export async function getChannelVideos(channelId: string, includePrivate = false): Promise<FeedVideo[]> {
	const conditions = [eq(videos.userId, channelId)];
	if (!includePrivate) {
		conditions.push(eq(videos.visibility, 'public'));
		conditions.push(ne(videos.copyrightStatus, 'claimed'));
	}

	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(and(...conditions))
		.orderBy(desc(videos.publishedAt))
		.limit(60);

	return rows.map((row) => mapVideo(row));
}

export async function getSubscriberCount(channelId: string): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(subscriptions)
		.where(eq(subscriptions.channelId, channelId));
	return Number(row?.count ?? 0);
}

export async function isSubscribed(userId: string, channelId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: subscriptions.id })
		.from(subscriptions)
		.where(and(eq(subscriptions.subscriberId, userId), eq(subscriptions.channelId, channelId)))
		.limit(1);
	return Boolean(row);
}

export async function getSubscribedChannels(userId: string): Promise<ChannelSummary[]> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			verified: user.verified,
			subscriberCount: sql<number>`(select count(*) from ${subscriptions} s where s.channel_id = ${user.id})`
		})
		.from(subscriptions)
		.innerJoin(user, eq(subscriptions.channelId, user.id))
		.where(eq(subscriptions.subscriberId, userId))
		.orderBy(desc(subscriptions.createdAt));

	return rows.map((row) => ({ ...row, subscriberCount: Number(row.subscriberCount) }));
}

export async function getSubscriptionFeed(userId: string): Promise<FeedVideo[]> {
	const channels = await db
		.select({ channelId: subscriptions.channelId })
		.from(subscriptions)
		.where(eq(subscriptions.subscriberId, userId));

	if (channels.length === 0) return [];

	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(
			and(
				eq(videos.visibility, 'public'),
				ne(videos.copyrightStatus, 'claimed'),
				inArray(
					videos.userId,
					channels.map((channel) => channel.channelId)
				)
			)
		)
		.orderBy(desc(videos.publishedAt))
		.limit(48);

	return rows.map((row) => mapVideo(row));
}

export async function getHistory(userId: string) {
	const rows = await db
		.select({
			video: videoColumns,
			author: authorColumns,
			progress: watchHistory.progress,
			watchedAt: watchHistory.updatedAt
		})
		.from(watchHistory)
		.innerJoin(videos, eq(watchHistory.videoId, videos.id))
		.innerJoin(user, eq(videos.userId, user.id))
		.where(eq(watchHistory.userId, userId))
		.orderBy(desc(watchHistory.updatedAt))
		.limit(50);

	return rows.map((row) => ({ ...mapVideo(row, row.progress), watchedAt: row.watchedAt }));
}

export async function getLikedVideos(userId: string) {
	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(likes)
		.innerJoin(videos, eq(likes.videoId, videos.id))
		.innerJoin(user, eq(videos.userId, user.id))
		.where(and(eq(likes.userId, userId), eq(likes.type, 1)))
		.orderBy(desc(likes.createdAt))
		.limit(50);

	return rows.map((row) => mapVideo(row));
}

export async function getMyVideos(userId: string) {
	const rows = await db
		.select({
			video: {
				...videoColumns,
				likeCount: videos.likeCount,
				commentCount: videos.commentCount,
				publishedAt: videos.publishedAt
			},
			author: authorColumns
		})
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(eq(videos.userId, userId))
		.orderBy(desc(videos.publishedAt))
		.limit(100);

	return rows.map((row) => ({ ...mapVideo(row), ...row.video }));
}

export async function searchVideos(query: string) {
	const q = query.trim();
	if (!q) return [];
	const pattern = `*${[...q]
		.map((ch) => {
			if (/[\p{L}]/u.test(ch)) {
				const upper = ch.toUpperCase();
				const lower = ch.toLowerCase();
				return upper === lower ? ch : `[${upper}${lower}]`;
			}
			if (ch === '*' || ch === '?' || ch === '[' || ch === ']') return `[${ch}]`;
			return ch;
		})
		.join('')}*`;
	const conditions = [
		sql`${videos.title} GLOB ${pattern}`,
		sql`${videos.description} GLOB ${pattern}`,
		sql`${user.name} GLOB ${pattern}`
	];
	const rows = await db
		.select({ video: videoColumns, author: authorColumns })
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.where(and(eq(videos.visibility, 'public'), ne(videos.copyrightStatus, 'claimed'), or(...conditions)))
		.orderBy(desc(videos.publishedAt))
		.limit(48);

	return rows.map((row) => mapVideo(row));
}

export async function getVideoReaction(userId: string, videoId: string): Promise<number> {
	const [row] = await db
		.select({ type: likes.type })
		.from(likes)
		.where(and(eq(likes.userId, userId), eq(likes.videoId, videoId)))
		.limit(1);
	return row?.type ?? 0;
}

export async function hasWatched(userId: string, videoId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: watchHistory.id })
		.from(watchHistory)
		.where(and(eq(watchHistory.userId, userId), eq(watchHistory.videoId, videoId)))
		.limit(1);
	return Boolean(row);
}

export async function getWatchProgress(userId: string, videoId: string): Promise<number> {
	const [row] = await db
		.select({ progress: watchHistory.progress })
		.from(watchHistory)
		.where(and(eq(watchHistory.userId, userId), eq(watchHistory.videoId, videoId)))
		.limit(1);
	return row?.progress ?? 0;
}

export async function getComments(videoId: string, userId?: string): Promise<CommentData[]> {
	const rows = await db
		.select({
			id: comments.id,
			content: comments.content,
			createdAt: comments.createdAt,
			likeCount: comments.likeCount,
			parentId: comments.parentId,
			pinned: comments.pinned,
			author: authorColumns,
			likedByMe: userId
				? sql<number>`(select count(*) from ${commentLikes} where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.userId} = ${userId} and ${commentLikes.type} = 1)`
				: sql<number>`0`
		})
		.from(comments)
		.innerJoin(user, eq(comments.userId, user.id))
		.where(eq(comments.videoId, videoId))
		.orderBy(desc(comments.createdAt));

	const map = new Map<string, CommentData>();
	for (const row of rows) {
		map.set(row.id, {
			id: row.id,
			content: row.content,
			createdAt: row.createdAt,
			likeCount: row.likeCount,
			pinned: Boolean(row.pinned),
			likedByMe: Number(row.likedByMe) > 0,
			user: row.author,
			replies: []
		});
	}

	const roots: CommentData[] = [];
	for (const row of rows) {
		const item = map.get(row.id)!;
		if (row.parentId && map.has(row.parentId)) {
			map.get(row.parentId)!.replies.push(item);
		} else {
			roots.push(item);
		}
	}

	for (const comment of roots) {
		comment.replies.sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		);
	}

	return roots.sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

export async function getVideoForOwner(videoId: string, userId: string) {
	const [row] = await db
		.select({ id: videos.id, userId: videos.userId, title: videos.title })
		.from(videos)
		.where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
		.limit(1);
	return row ?? null;
}

export async function getUserProfile(id: string) {
	const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
	return row ?? null;
}

export async function incrementViews(videoId: string) {
	await db
		.update(videos)
		.set({ viewCount: sql`${videos.viewCount} + 1` })
		.where(eq(videos.id, videoId));
}

export async function clearHistory(userId: string) {
	await db.delete(watchHistory).where(eq(watchHistory.userId, userId));
}
