import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { streamMessages } from '#lib/server/db/schema';
import { user } from '#lib/server/db/auth.schema';

export const GET: RequestHandler = async ({ params }) => {
	const rows = await db
		.select({
			id: streamMessages.id,
			content: streamMessages.content,
			createdAt: streamMessages.createdAt,
			name: user.name,
			image: user.image
		})
		.from(streamMessages)
		.innerJoin(user, eq(streamMessages.userId, user.id))
		.where(eq(streamMessages.streamId, params.id))
		.orderBy(desc(streamMessages.createdAt))
		.limit(50);
	return json({ messages: rows.reverse().map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() })) });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	let body: { content?: unknown } = {};
	try { body = await request.json(); } catch {}
	const content = String(body.content ?? '').trim().slice(0, 300);
	if (!content) throw error(400, 'Пустое сообщение');

	await db.insert(streamMessages).values({
		id: randomUUID(),
		streamId: params.id,
		userId: locals.user.id,
		content
	});
	return json({ ok: true });
};
