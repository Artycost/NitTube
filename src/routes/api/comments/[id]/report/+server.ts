import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { commentReports, comments } from '#lib/server/db/schema';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	const [comment] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, params.id)).limit(1);
	if (!comment) throw error(404, 'Комментарий не найден');

	let reason = '';
	try {
		const body = await request.json();
		reason = String(body.reason ?? '').slice(0, 200);
	} catch {}

	await db.insert(commentReports).values({
		id: randomUUID(),
		commentId: params.id,
		userId: locals.user.id,
		reason: reason || 'Жалоба без причины'
	});
	return json({ ok: true });
};
