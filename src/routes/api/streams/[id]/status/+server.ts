import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { streams } from '#lib/server/db/schema';

export const GET: RequestHandler = async ({ params }) => {
	const [row] = await db
		.select({ isLive: streams.isLive, viewers: streams.viewers })
		.from(streams)
		.where(eq(streams.id, params.id))
		.limit(1);
	if (!row) throw error(404, 'Трансляция не найдена');
	return json({ isLive: row.isLive, viewers: row.viewers });
};
