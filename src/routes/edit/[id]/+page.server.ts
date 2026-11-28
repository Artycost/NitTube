import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/server/db';
import { videos } from '#lib/server/db/schema';
import { getSubscriberCount } from '#lib/server/queries';
import { findLinks, LINKS_MIN_SUBSCRIBERS } from '#lib/utils/links';
import { cleanMultilineText, cleanText, validateTitle } from '#lib/utils/validation';

const text = (input: FormDataEntryValue | null) =>
	(input instanceof File ? '' : (input ?? '')).trim();

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const [video] = await db.select().from(videos).where(eq(videos.id, params.id)).limit(1);
	if (!video) throw redirect(302, '/library');
	if (video.userId !== locals.user.id) throw error(403, 'Недостаточно прав');
	return {
		video: {
			id: video.id,
			title: video.title,
			description: video.description ?? '',
			category: video.category ?? 'Другое',
			visibility: video.visibility,
			tags: (video.tags ?? []).join(', '),
			thumbnail: video.thumbnail
		}
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const [video] = await db.select({ userId: videos.userId }).from(videos).where(eq(videos.id, params.id)).limit(1);
		if (!video) throw error(404, 'Видео не найдено');
		if (video.userId !== locals.user.id) throw error(403, 'Недостаточно прав');

		const form = await request.formData();
		const titleProblem = validateTitle(text(form.get('title')));
		if (titleProblem) return fail(400, { message: titleProblem });
		const title = cleanText(text(form.get('title')));
		const description = cleanMultilineText(text(form.get('description'))).slice(0, 5000);
		const category = text(form.get('category')) || 'Другое';
		const visibility = text(form.get('visibility'));
		if (!['public', 'unlisted', 'private'].includes(visibility)) return fail(400, { message: 'Неверный доступ' });
		let tags = text(form.get('tags'))
			.split(',')
			.map((tag) => cleanText(tag).slice(0, 30))
			.filter(Boolean)
			.slice(0, 12);
		const hashtags = (description.match(/#[\p{L}\p{N}_]{2,30}/gu) ?? []).map((tag) => tag.slice(1).toLowerCase());
		tags = [...new Set([...tags, ...hashtags])].slice(0, 12);

		const subscriberCount = await getSubscriberCount(locals.user.id);
		const isCreator = Boolean((locals.user as { creator?: boolean }).creator);
		if (!isCreator && subscriberCount < LINKS_MIN_SUBSCRIBERS) {
			const links = [title, description, tags.join(' ')].flatMap(findLinks);
			if (links.length) return fail(400, { message: `Ссылки доступны создателям и каналам от ${LINKS_MIN_SUBSCRIBERS} подписчиков.` });
		}

		await db
			.update(videos)
			.set({ title, description, category, visibility: visibility as 'public' | 'unlisted' | 'private', tags })
			.where(eq(videos.id, params.id));

		return { success: true };
	}
};
