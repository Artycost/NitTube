import { json } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { videos } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json({ tags: [] });

	const query = (url.searchParams.get('q') ?? '').trim().replace(/^#/, '').toLowerCase().slice(0, 30);
	if (!query) return json({ tags: [] });

	const rows = await db
		.select({ tags: videos.tags, description: videos.description })
		.from(videos)
		.where(and(eq(videos.visibility, 'public'), ne(videos.copyrightStatus, 'claimed')))
		.limit(500);

	const counts = new Map<string, number>();
	for (const row of rows) {
		const fromField = (row.tags ?? []).map((tag) => tag.toLowerCase().trim());
		const fromDescription = (row.description ?? '').match(/#[\p{L}\p{N}_]{2,30}/gu)?.map((tag) => tag.slice(1).toLowerCase()) ?? [];
		for (const tag of new Set([...fromField, ...fromDescription])) {
			if (!tag || !tag.includes(query)) continue;
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	const tags = [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
		.slice(0, 8);

	return json({ tags });
};
