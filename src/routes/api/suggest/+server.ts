import { json } from '@sveltejs/kit';
import { like } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { user } from '#lib/server/db/schema';
import { searchVideos } from '#lib/server/queries';

export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json({ videos: [], channels: [] });

	const videos = (await searchVideos(q)).slice(0, 6).map((video) => ({
		id: video.id,
		title: video.title,
		thumbnail: video.thumbnail,
		channel: video.user.name,
		views: video.viewCount
	}));

	const channels = await db
		.select({ id: user.id, name: user.name, image: user.image })
		.from(user)
		.where(like(user.name, `%${q}%`))
		.limit(3);

	return json({ videos, channels });
};
