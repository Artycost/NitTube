import { error, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db';
import { streams } from '#lib/server/db/schema';
import { user } from '#lib/server/db/auth.schema';
import {
	getComments,
	getRecommendations,
	getVideo,
	getVideoReaction,
	getWatchProgress,
	incrementViews,
	isSubscribed
} from '#lib/server/queries';

export const load: PageServerLoad = async ({ params, locals, cookies, url }) => {
	const [stream] = await db.select().from(streams).where(eq(streams.id, params.id)).limit(1);

	if (stream) {
		const [profile] = await db
			.select({ name: user.name, image: user.image, streamKey: user.streamKey })
			.from(user)
			.where(eq(user.id, stream.userId))
			.limit(1);
		return {
			live: {
				id: stream.id,
				title: stream.title,
				category: stream.category,
				viewers: stream.viewers,
				isLive: stream.isLive,
				startedAt: stream.startedAt ? new Date(stream.startedAt).toISOString() : null,
				channelName: profile?.name ?? 'Автор',
				channelImage: profile?.image ?? null,
				userId: stream.userId,
				hlsUrl: `/hls/${(profile?.streamKey ?? stream.id).replace(/[^a-zA-Z0-9_-]/g, '')}/index.m3u8`
			},
			video: null,
			recommendations: [],
			comments: [],
			reaction: 0,
			subscribed: false,
			progress: 0,
			isOwner: locals.user?.id === stream.userId
		};
	}

	const video = await getVideo(params.id);
	if (!video) throw error(404, 'Видео не найдено');
	if (video.isShort) throw redirect(303, `/shorts?v=${video.id}`);

	const isOwner = locals.user?.id === video.userId;
	if (video.visibility !== 'public' && !isOwner) throw error(404, 'Видео не найдено');

	const viewerId = locals.user?.id;

	const [recommendations, comments, reaction, subscribed, progress] = await Promise.all([
		getRecommendations(video.id, video.category, viewerId, randomUUID()),
		getComments(video.id, viewerId),
		viewerId ? getVideoReaction(viewerId, video.id) : Promise.resolve(0),
		viewerId && !isOwner ? isSubscribed(viewerId, video.userId) : Promise.resolve(false),
		viewerId ? getWatchProgress(viewerId, video.id) : Promise.resolve(0)
	]);

	const cookieName = `seen_${video.id}`;
	if (!cookies.get(cookieName)) {
		cookies.set(cookieName, '1', { path: '/', maxAge: 60 * 60 * 6, httpOnly: true, sameSite: 'lax' });
		await incrementViews(video.id);
		video.viewCount += 1;
	}

	return {
		video,
		recommendations,
		comments,
		reaction,
		subscribed,
		progress,
		isOwner
	};
};
