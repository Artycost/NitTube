import { randomUUID } from 'node:crypto';
import { getFeed, getLiveStreams, getShorts } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const category = url.searchParams.get('category') ?? 'Все';
	const seed = url.searchParams.get('seed') ?? randomUUID();
	const viewerId = locals.user?.id;
	const videos = await getFeed(category === 'Все' ? undefined : category, viewerId, seed);
	const shorts = category === 'Все' ? await getShorts(viewerId, seed) : [];
	const liveStreams = category === 'Все' ? await getLiveStreams() : [];
	return { videos, shorts, liveStreams, category, seed };
};
