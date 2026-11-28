import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db';
import { watchHistory } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');

	let body: { videoId?: unknown; progress?: unknown; completed?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Неверный запрос');
	}

	const videoId = String(body.videoId ?? '');
	const progress = Math.max(0, Math.min(86_400, Number(body.progress) || 0));
	const completed = Boolean(body.completed);

	if (!videoId) throw error(400, 'Не указано видео');

	try {
		await db
			.insert(watchHistory)
			.values({
				id: randomUUID(),
				userId: locals.user.id,
				videoId,
				progress,
				completed,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: [watchHistory.userId, watchHistory.videoId],
				set: { progress, completed, updatedAt: new Date() }
			});
	} catch {
		throw error(400, 'Не удалось сохранить прогресс');
	}

	return json({ ok: true });
};
