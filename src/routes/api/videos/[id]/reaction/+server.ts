import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { likes, videos } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return json({ reaction: 0 });
	const [row] = await db
		.select({ type: likes.type })
		.from(likes)
		.where(and(eq(likes.userId, locals.user.id), eq(likes.videoId, params.id)))
		.limit(1);
	return json({ reaction: row?.type ?? 0 });
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');

	const videoId = params.id;
	if (!videoId) throw error(400, 'Неверный запрос');

	let body: { type?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Неверный запрос');
	}

	const type = Number(body.type);
	if (![1, -1, 0].includes(type)) throw error(400, 'Неверный тип реакции');

	if (type === 0) {
		await db.delete(likes).where(and(eq(likes.userId, locals.user.id), eq(likes.videoId, videoId)));
	} else {
		await db
			.insert(likes)
			.values({ id: randomUUID(), userId: locals.user.id, videoId, type })
			.onConflictDoUpdate({
				target: [likes.userId, likes.videoId],
				set: { type }
			});
	}

	const [likeRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(likes)
		.where(and(eq(likes.videoId, videoId), eq(likes.type, 1)));

	const [dislikeRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(likes)
		.where(and(eq(likes.videoId, videoId), eq(likes.type, -1)));

	const likeCount = Number(likeRow?.count ?? 0);
	const dislikeCount = Number(dislikeRow?.count ?? 0);

	await db.update(videos).set({ likeCount, dislikeCount }).where(eq(videos.id, videoId));

	return json({ likes: likeCount, dislikes: dislikeCount, reaction: type });
};
