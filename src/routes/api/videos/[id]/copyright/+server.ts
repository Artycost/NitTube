import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { copyrightClaims, videos } from '#lib/server/db/schema';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	const [video] = await db.select({ id: videos.id, userId: videos.userId }).from(videos).where(eq(videos.id, params.id)).limit(1);
	if (!video) throw error(404, 'Видео не найдено');
	if (video.userId === locals.user.id) throw error(400, 'Нельзя жаловаться на своё видео');

	let reason = '';
	try {
		const body = await request.json();
		reason = String(body.reason ?? '').trim().slice(0, 500);
	} catch {}
	if (!reason) throw error(400, 'Укажите причину жалобы');

	const [existing] = await db
		.select({ id: copyrightClaims.id })
		.from(copyrightClaims)
		.where(
			and(
				eq(copyrightClaims.videoId, params.id),
				eq(copyrightClaims.claimantId, locals.user.id),
				eq(copyrightClaims.status, 'pending')
			)
		)
		.limit(1);
	if (existing) return json({ ok: true, message: 'Жалоба уже отправлена' });

	await db.insert(copyrightClaims).values({
		id: randomUUID(),
		videoId: params.id,
		claimantId: locals.user.id,
		type: 'manual',
		status: 'pending',
		reason
	});
	return json({ ok: true });
};
