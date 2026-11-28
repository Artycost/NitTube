import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { comments, user, videos } from '#lib/server/db/schema';
import { cleanText, validateUserText } from '#lib/utils/validation';
import { findLinks, LINKS_MIN_SUBSCRIBERS } from '#lib/utils/links';
import { getSubscriberCount } from '#lib/server/queries';
import { isBanned, moderateText } from '#lib/server/moderation';
import type { RequestHandler } from './$types';

import { getComments } from '#lib/server/queries';

export const GET: RequestHandler = async ({ params, locals }) => {
	const comments = await getComments(params.id, locals.user?.id);
	return json({ comments });
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');

	const videoId = params.id;
	if (!videoId) throw error(400, 'Неверный запрос');

	let body: { content?: unknown; parentId?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Неверный запрос');
	}

	const content = cleanText(String(body.content ?? '')).slice(0, 2000);
	if (!content) throw error(400, 'Комментарий пустой');
	const contentProblem = validateUserText(content);
	if (contentProblem) throw error(400, `Комментарий: ${contentProblem}`);
	const subscriberCount = await getSubscriberCount(locals.user.id);
	const isCreator = Boolean((locals.user as { creator?: boolean }).creator);
	if (!isCreator && subscriberCount < LINKS_MIN_SUBSCRIBERS && findLinks(content).length) {
		throw error(400, `Ссылки доступны создателям и каналам от ${LINKS_MIN_SUBSCRIBERS} подписчиков.`);
	}
	const moderation = moderateText(content);
	if (moderation.blocked) throw error(403, `Комментарий отклонён: ${moderation.reason}`);

	const parentId = body.parentId ? String(body.parentId) : null;
	if (parentId) {
		const [parent] = await db
			.select({ id: comments.id, videoId: comments.videoId })
			.from(comments)
			.where(eq(comments.id, parentId))
			.limit(1);
		if (!parent || parent.videoId !== videoId) throw error(400, 'Родительский комментарий не найден');
	}

	const id = randomUUID();

	await db.insert(comments).values({
		id,
		userId: locals.user.id,
		videoId,
		parentId,
		content
	});

	const [countRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(comments)
		.where(eq(comments.videoId, videoId));

	await db
		.update(videos)
		.set({ commentCount: Number(countRow?.count ?? 0) })
		.where(eq(videos.id, videoId));

	const [author] = await db
		.select({ id: user.id, name: user.name, image: user.image, verified: user.verified })
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);

	return json({
		id,
		content,
		createdAt: new Date(),
		likeCount: 0,
		likedByMe: false,
		user: author,
		replies: []
	});
};
