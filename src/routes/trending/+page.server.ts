import { getTrending } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const videos = await getTrending();
	return { videos };
};
