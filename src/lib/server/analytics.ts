import { desc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { comments, likes, subscriptions, user, videos, watchHistory } from './db/schema';
import { getSubscriberCount } from './queries';

const num = (value: unknown) => Number(value ?? 0);

export async function getChannelAnalytics(userId: string) {
	const [summary] = await db
		.select({
			videoCount: sql<number>`count(*)`,
			views: sql<number>`coalesce(sum(${videos.viewCount}), 0)`,
			likes: sql<number>`coalesce(sum(${videos.likeCount}), 0)`,
			dislikes: sql<number>`coalesce(sum(${videos.dislikeCount}), 0)`,
			comments: sql<number>`coalesce(sum(${videos.commentCount}), 0)`,
			watchTime: sql<number>`coalesce(sum(${videos.duration} * ${videos.viewCount}), 0)`
		})
		.from(videos)
		.where(eq(videos.userId, userId));

	const subscribers = await getSubscriberCount(userId);

	const [watch] = await db
		.select({
			sessions: sql<number>`count(${watchHistory.id})`,
			viewers: sql<number>`count(distinct ${watchHistory.userId})`,
			avgSeconds: sql<number>`coalesce(avg(${watchHistory.progress}), 0)`,
			avgPercent: sql<number>`coalesce(avg(case when ${videos.duration} > 0 then min(100, ${watchHistory.progress} * 100.0 / ${videos.duration}) else 0 end), 0)`,
			completed: sql<number>`coalesce(sum(case when ${watchHistory.completed} = 1 then 1 else 0 end), 0)`
		})
		.from(watchHistory)
		.innerJoin(videos, eq(watchHistory.videoId, videos.id))
		.where(eq(videos.userId, userId));

	const [reaction] = await db
		.select({
			likes: sql<number>`count(*)`,
			dislikes: sql<number>`coalesce(sum(case when ${likes.type} = -1 then 1 else 0 end), 0)`
		})
		.from(likes)
		.innerJoin(videos, eq(likes.videoId, videos.id))
		.where(eq(videos.userId, userId));

	const [commentRow] = await db
		.select({ count: sql<number>`count(${comments.id})` })
		.from(comments)
		.innerJoin(videos, eq(comments.videoId, videos.id))
		.where(eq(videos.userId, userId));

	const dailyRows = await db
		.select({
			date: sql<string>`strftime('%Y-%m-%d', ${watchHistory.updatedAt}, 'unixepoch')`,
			views: sql<number>`count(*)`
		})
		.from(watchHistory)
		.innerJoin(videos, eq(watchHistory.videoId, videos.id))
		.where(eq(videos.userId, userId))
		.groupBy(sql`strftime('%Y-%m-%d', ${watchHistory.updatedAt}, 'unixepoch')`)
		.orderBy(sql`strftime('%Y-%m-%d', ${watchHistory.updatedAt}, 'unixepoch')`);

	const dailyMap = new Map(dailyRows.map((row) => [row.date, num(row.views)]));
	const daily: { date: string; views: number }[] = [];
	const today = new Date();
	for (let i = 27; i >= 0; i--) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const key = d.toISOString().slice(0, 10);
		daily.push({ date: key, views: dailyMap.get(key) ?? 0 });
	}

	const all = await db
		.select({
			id: videos.id,
			title: videos.title,
			views: videos.viewCount,
			likes: videos.likeCount,
			dislikes: videos.dislikeCount,
			comments: videos.commentCount,
			duration: videos.duration,
			videoUrl: videos.videoUrl,
			quality: videos.quality,
			createdAt: videos.createdAt,
			thumbnail: videos.thumbnail
		})
		.from(videos)
		.where(eq(videos.userId, userId))
		.orderBy(desc(videos.viewCount));

	const recentSubscribers = await db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			createdAt: subscriptions.createdAt
		})
		.from(subscriptions)
		.innerJoin(user, eq(subscriptions.subscriberId, user.id))
		.where(eq(subscriptions.channelId, userId))
		.orderBy(desc(subscriptions.createdAt))
		.limit(6);

	const recentComments = await db
		.select({
			id: comments.id,
			content: comments.content,
			createdAt: comments.createdAt,
			author: user.name,
			image: user.image,
			videoTitle: videos.title,
			videoId: videos.id
		})
		.from(comments)
		.innerJoin(user, eq(comments.userId, user.id))
		.innerJoin(videos, eq(comments.videoId, videos.id))
		.where(eq(videos.userId, userId))
		.orderBy(desc(comments.createdAt))
		.limit(4);

	const views = num(summary?.views);
	const likesCount = num(summary?.likes);
	const dislikes = num(summary?.dislikes);

	return {
		videoCount: num(summary?.videoCount),
		views,
		likes: likesCount,
		dislikes,
		comments: num(summary?.comments),
		watchTime: num(summary?.watchTime),
		subscribers,
		watchSessions: num(watch?.sessions),
		uniqueViewers: num(watch?.viewers),
		avgSeconds: Math.round(num(watch?.avgSeconds)),
		avgPercent: Math.round(num(watch?.avgPercent)),
		completed: num(watch?.completed),
		reactionLikes: num(reaction?.likes),
		reactionDislikes: num(reaction?.dislikes),
		commentCount: num(commentRow?.count),
		likeRatio: views ? Math.round((likesCount / views) * 100) : 0,
		daily,
		topVideos: all.slice(0, 8).map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
		topLiked: [...all].sort((a, b) => b.likes - a.likes).slice(0, 5).map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
		recentSubscribers: recentSubscribers.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
		recentComments: recentComments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))
	};
}
