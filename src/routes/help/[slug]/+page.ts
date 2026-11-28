import { error } from '@sveltejs/kit';
import { getCategory } from '#lib/data/help';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const category = getCategory(params.slug);
	if (!category) throw error(404, 'Раздел справки не найден');
	return { category };
};
