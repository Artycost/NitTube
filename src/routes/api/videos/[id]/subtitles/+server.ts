import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { readFile, writeFile } from 'node:fs/promises';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { videos } from '#lib/server/db/schema';
import { findSubtitlePath, subtitlePath } from '#lib/server/files';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const [video] = await db
		.select({ id: videos.id, videoUrl: videos.videoUrl })
		.from(videos)
		.where(eq(videos.id, params.id))
		.limit(1);
	if (!video) throw error(404, 'Видео не найдено');

	let body = 'WEBVTT\n\n';
	let found = false;
	const file = await findSubtitlePath(video.id, video.videoUrl);
	if (file) {
		try {
			body = await readFile(file, 'utf8');
			found = true;
		} catch {
			// fall through to an empty track
		}
	}

	setHeaders({
		'content-type': 'text/vtt; charset=utf-8',
		'cache-control': 'public, max-age=60',
		'x-vuetube-subtitles': found ? 'found' : 'none'
	});
	return new Response(body);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');
	const [video] = await db
		.select({ userId: videos.userId })
		.from(videos)
		.where(eq(videos.id, params.id))
		.limit(1);
	if (!video) throw error(404, 'Видео не найдено');
	if (video.userId !== locals.user.id) throw error(403, 'Недостаточно прав');

	let text = await request.text();
	if (text.length > 1024 * 1024) throw error(400, 'Слишком большой файл субтитров');
	if (!text.trimStart().startsWith('WEBVTT')) text = `WEBVTT\n\n${text}`;
	await writeFile(subtitlePath(params.id), text, 'utf8');
	return json({ ok: true });
};
