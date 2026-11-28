import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { blockedUsers } from '#lib/server/db/schema';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	if (params.id === locals.user.id) throw error(400, 'Нельзя заблокировать себя');
	const [existing] = await db
		.select({ id: blockedUsers.id })
		.from(blockedUsers)
		.where(and(eq(blockedUsers.userId, locals.user.id), eq(blockedUsers.blockedId, params.id)))
		.limit(1);
	if (!existing) {
		await db.insert(blockedUsers).values({
			id: randomUUID(),
			userId: locals.user.id,
			blockedId: params.id
		});
	}
	return json({ ok: true });
};
