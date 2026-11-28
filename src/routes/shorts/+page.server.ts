import { randomUUID } from 'node:crypto';
import type { PageServerLoad } from './$types';
import { getShorts } from '#lib/server/queries';

export const load: PageServerLoad = async ({ url, locals }) => {
	const shorts = await getShorts(locals.user?.id, randomUUID());
	const requested = url.searchParams.get('v');
	return { shorts, initialId: shorts.some((s) => s.id === requested) ? requested : null };
};
