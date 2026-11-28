import type { PageServerLoad } from './$types';
import { searchVideos } from '#lib/server/queries';

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	const videos = q ? await searchVideos(q) : [];
	return { q, videos };
};
