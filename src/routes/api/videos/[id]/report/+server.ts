import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { videos, videoReports } from '#lib/server/db/schema';

const REASONS = ['copyright', 'sexual', 'violence', 'spam', 'hate', 'other'];

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	const [video] = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, params.id)).limit(1);
	if (!video) throw error(404, 'Видео не найдено');

	let body: { reason?: unknown; detail?: unknown } = {};
	try { body = await request.json(); } catch {}
	const reason = String(body.reason ?? '');
	if (!REASONS.includes(reason)) throw error(400, 'Неверная причина жалобы');

	await db.insert(videoReports).values({
		id: randomUUID(),
		videoId: params.id,
		userId: locals.user.id,
		reason,
		detail: String(body.detail ?? '').slice(0, 500)
	});

	return json({ ok: true });
};
