import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getChannelAnalytics } from '#lib/server/analytics';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/login');
	const tab = url.searchParams.get('tab') ?? 'overview';
	const analytics = await getChannelAnalytics(locals.user.id);
	return {
		analytics,
		tab: ['overview', 'content', 'reach', 'engagement', 'audience'].includes(tab) ? tab : 'overview'
	};
};
