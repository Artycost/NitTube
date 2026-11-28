import { redirect } from '@sveltejs/kit';
import { getSubscriberCount } from '#lib/server/queries';
import { LINKS_MIN_SUBSCRIBERS } from '#lib/utils/links';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login?redirect=/upload');
	return {
		subscriberCount: await getSubscriberCount(locals.user.id),
		isCreator: Boolean((locals.user as { creator?: boolean }).creator),
		linksMinSubscribers: LINKS_MIN_SUBSCRIBERS
	};
};
