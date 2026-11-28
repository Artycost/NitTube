import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { commentLikes, comments } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');

	const commentId = params.id;
	if (!commentId) throw error(400, 'Неверный запрос');

	let body: { liked?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Неверный запрос');
	}

	const liked = Boolean(body.liked);

	if (liked) {
		await db
			.insert(commentLikes)
			.values({
				id: randomUUID(),
				userId: locals.user.id,
				commentId,
				type: 1
			})
			.onConflictDoUpdate({
				target: [commentLikes.userId, commentLikes.commentId],
				set: { type: 1 }
			});
	} else {
		await db
			.delete(commentLikes)
			.where(and(eq(commentLikes.userId, locals.user.id), eq(commentLikes.commentId, commentId)));
	}

	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(commentLikes)
		.where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.type, 1)));

	const count = Number(row?.count ?? 0);

	await db.update(comments).set({ likeCount: count }).where(eq(comments.id, commentId));

	return json({ liked, count });
};
