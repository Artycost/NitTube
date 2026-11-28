import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db';
import { videos } from '#lib/server/db/schema';
import { deleteUpload, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, saveUpload } from '#lib/server/files';
import { banFor7Days, isBanned, moderateText } from '#lib/server/moderation';
import { createQualityVariants, ensureBrowserCompatible, extractEmbeddedSubtitles, readMediaInfo } from '#lib/server/transcode';
import { transcribeSubtitles } from '#lib/server/subtitles';
import { checkAutoClaim } from '#lib/server/copyright';
import { getSubscriberCount } from '#lib/server/queries';
import { findLinks, LINKS_MIN_SUBSCRIBERS } from '#lib/utils/links';
import { cleanMultilineText, cleanText, validateTitle, validateUserText } from '#lib/utils/validation';
import type { VideoVisibility } from '#lib/server/db/schema';
import type { RequestHandler } from './$types';

const CATEGORIES = new Set([
	'Музыка',
	'Игры',
	'Технологии',
	'Дизайн',
	'Обучение',
	'Кино',
	'Авто',
	'Спорт',
	'Путешествия',
	'Еда',
	'Юмор',
	'Новости',
	'Другое'
]);

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');

	const ban = await isBanned(locals.user.id);
	if (ban.banned) {
		throw error(403, `Загрузка запрещена: блокировка ещё ${ban.daysLeft} дн. Причина: ${ban.reason}`);
	}

	const form = await request.formData();
	const file = form.get('video');

	if (!(file instanceof File) || file.size === 0) throw error(400, 'Выберите видеофайл');
	if (!file.type.startsWith('video/')) throw error(400, 'Файл должен быть видео');
	if (file.size > MAX_VIDEO_SIZE) throw error(400, 'Видео больше 1 ГБ');

	const titleProblem = validateTitle(String(form.get('title') ?? '').trim());
	if (titleProblem) throw error(400, titleProblem);
	const title = cleanText(String(form.get('title') ?? ''));

	const description = cleanMultilineText(String(form.get('description') ?? '')).slice(0, 5000);
	const descriptionProblem = validateUserText(description);
	if (descriptionProblem) throw error(400, `Описание: ${descriptionProblem}`);
	const category = String(form.get('category') ?? 'Другое');
	const visibility = String(form.get('visibility') ?? 'public') as VideoVisibility;
	const duration = Math.max(0, Math.min(86_400, Number.parseInt(String(form.get('duration') ?? '0'), 10) || 0));
	const orientation = String(form.get('orientation') ?? '').trim();
	const isShort = orientation
		? orientation === 'vertical'
		: duration > 0 && duration <= 60;
	if (isShort && duration > 240) throw error(400, 'Shorts может быть не длиннее 240 секунд');

	if (!CATEGORIES.has(category)) throw error(400, 'Неизвестная категория');
	if (!['public', 'unlisted', 'private'].includes(visibility)) throw error(400, 'Неверный доступ');

	let tags: string[] = [];
	try {
		const parsed = JSON.parse(String(form.get('tags') ?? '[]'));
		if (Array.isArray(parsed)) {
			tags = parsed
				.map((tag) => cleanText(String(tag)).slice(0, 30))
				.filter((tag) => validateUserText(tag) === null)
				.filter(Boolean)
				.slice(0, 12);
		}
	} catch {
		tags = [];
	}

	// Хештеги из описания тоже становятся тегами и усиливают рекомендации.
	const hashtags = (description.match(/#[\p{L}\p{N}_]{2,30}/gu) ?? []).map((tag) => tag.slice(1).toLowerCase());
	tags = [...new Set([...tags, ...hashtags])].slice(0, 12);

	const subscriberCount = await getSubscriberCount(locals.user.id);
	const isCreator = Boolean((locals.user as { creator?: boolean }).creator);
	const linksAllowed = isCreator || subscriberCount >= LINKS_MIN_SUBSCRIBERS;
	if (!linksAllowed) {
		const links = [title, description, tags.join(' ')].flatMap(findLinks);
		if (links.length) {
			throw error(
				400,
				`Ссылки доступны создателям и каналам от ${LINKS_MIN_SUBSCRIBERS} подписчиков (у вас ${subscriberCount}). Уберите их из названия, описания и тегов.`
			);
		}
	}

	const moderation = moderateText(title, description, tags.join(' '));
	if (moderation.blocked) {
		await banFor7Days(locals.user.id, moderation.reason);
		throw error(403, `Контент отклонён модерацией: ${moderation.reason}. Доступ к загрузке закрыт на 7 дней.`);
	}

	const thumb = form.get('thumbnail');
	if (thumb instanceof File && thumb.size > MAX_IMAGE_SIZE) throw error(400, 'Обложка больше 8 МБ');
	if (thumb instanceof File && thumb.size > 0 && !thumb.type.startsWith('image/')) {
		throw error(400, 'Обложка должна быть изображением');
	}

	let videoUrl: string | null = null;
	let thumbUrl: string | null = null;

	try {
		const uploadedVideoUrl = await saveUpload(file, 'videos');
		videoUrl = uploadedVideoUrl;
		if (thumb instanceof File && thumb.size > 0) {
			thumbUrl = await saveUpload(thumb, 'thumbs');
		}

		const id = randomUUID();
		// The client cannot be trusted to label quality: probe the file itself.
		let media = await readMediaInfo(uploadedVideoUrl);
		// Check browser compatibility and convert to H.264/AAC when necessary.
		const compatible = await ensureBrowserCompatible(id, uploadedVideoUrl, media);
		const playbackUrl = compatible.url;
		media = compatible.info;
		if (playbackUrl !== uploadedVideoUrl) videoUrl = playbackUrl;

		await db.insert(videos).values({
			id,
			userId: locals.user.id,
			title,
			description,
			videoUrl: playbackUrl,
			thumbnail: thumbUrl,
			duration: Math.round(media.duration) || duration,
			quality: media.qualityLabel || null,
			width: media.width,
			height: media.height,
			isShort,
			hasMusic: media.hasMusic,
			visibility,
			category,
			tags,
			publishedAt: new Date()
		});

		const claim = await checkAutoClaim(id, playbackUrl, locals.user.id);

		await createQualityVariants(id, playbackUrl, media);
		const embedded = await extractEmbeddedSubtitles(id, playbackUrl);
		if (!embedded) await transcribeSubtitles(id, playbackUrl);
		return json({ id, copyrightClaim: Boolean(claim) });
	} catch (cause) {
		await deleteUpload(videoUrl);
		await deleteUpload(thumbUrl);
		console.error('upload failed', cause);
		throw error(500, 'Не удалось сохранить видео');
	}
};
