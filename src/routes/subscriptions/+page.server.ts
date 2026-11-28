import { getSubscriptionFeed } from '#lib/server/queries';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const videos = await getSubscriptionFeed(locals.user.id);
	return { videos };
};
