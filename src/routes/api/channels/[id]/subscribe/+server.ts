import { error, json } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db';
import { subscriptions } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const channelId = params.id;
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(subscriptions)
		.where(eq(subscriptions.channelId, channelId));
	let subscribed = false;
	if (locals.user) {
		const [mine] = await db
			.select({ id: subscriptions.id })
			.from(subscriptions)
			.where(and(eq(subscriptions.subscriberId, locals.user.id), eq(subscriptions.channelId, channelId)))
			.limit(1);
		subscribed = Boolean(mine);
	}
	return json({ subscribed, count: Number(row?.count ?? 0) });
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');

	const channelId = params.id;
	if (!channelId) throw error(400, 'Неверный запрос');
	if (channelId === locals.user.id) throw error(400, 'Нельзя подписаться на себя');

	let body: { subscribed?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Неверный запрос');
	}

	const subscribed = Boolean(body.subscribed);

	if (subscribed) {
		await db
			.insert(subscriptions)
			.values({
				id: randomUUID(),
				subscriberId: locals.user.id,
				channelId
			})
			.onConflictDoNothing();
	} else {
		await db
			.delete(subscriptions)
			.where(
				and(
					eq(subscriptions.subscriberId, locals.user.id),
					eq(subscriptions.channelId, channelId)
				)
			);
	}

	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(subscriptions)
		.where(eq(subscriptions.channelId, channelId));

	return json({ subscribed, count: Number(row?.count ?? 0) });
};
