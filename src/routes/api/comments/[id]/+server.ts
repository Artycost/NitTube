import { error, json } from '@sveltejs/kit';
import { eq, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db';
import { comments, user, videos } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';
import { getComments } from '#lib/server/queries';

async function loadComment(id: string) {
	const [row] = await db
		.select({ id: comments.id, userId: comments.userId, videoId: comments.videoId })
		.from(comments)
		.where(eq(comments.id, id))
		.limit(1);
	return row;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const list = await getComments(params.id, locals.user?.id);
	return json({ comments: list });
};

export const PATCH: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	const comment = await loadComment(params.id);
	if (!comment) throw error(404, 'Комментарий не найден');
	const [video] = await db.select({ userId: videos.userId }).from(videos).where(eq(videos.id, comment.videoId)).limit(1);
	if (!video || video.userId !== locals.user.id) throw error(403, 'Только автор канала может закреплять комментарии');
	await db.update(comments).set({ pinned: sql`NOT ${comments.pinned}` }).where(eq(comments.id, params.id));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	const commentId = params.id;
	if (!commentId) throw error(400, 'Неверный запрос');

	const comment = await loadComment(commentId);
	if (!comment) throw error(404, 'Комментарий не найден');

	if (comment.userId !== locals.user.id) {
		const [video] = await db
			.select({ userId: videos.userId })
			.from(videos)
			.where(eq(videos.id, comment.videoId))
			.limit(1);
		if (!video || video.userId !== locals.user.id) throw error(403, 'Недостаточно прав');
	}

	await db.delete(comments).where(or(eq(comments.id, commentId), eq(comments.parentId, commentId)));

	const [countRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(comments)
		.where(eq(comments.videoId, comment.videoId));

	await db
		.update(videos)
		.set({ commentCount: Number(countRow?.count ?? 0) })
		.where(eq(videos.id, comment.videoId));

	return json({ ok: true });
};
