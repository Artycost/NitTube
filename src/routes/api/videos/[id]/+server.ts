import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { videos } from '#lib/server/db/schema';
import { deleteUpload, publicToPath, subtitlePath } from '#lib/server/files';
import { videoFiles } from '#lib/server/db/schema';
import { unlink } from 'node:fs/promises';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Требуется авторизация');

	const videoId = params.id;
	if (!videoId) throw error(400, 'Неверный запрос');

	const [video] = await db
		.select({
			id: videos.id,
			userId: videos.userId,
			videoUrl: videos.videoUrl,
			thumbnail: videos.thumbnail
		})
		.from(videos)
		.where(eq(videos.id, videoId))
		.limit(1);

	if (!video) throw error(404, 'Видео не найдено');
	if (video.userId !== locals.user.id) throw error(403, 'Недостаточно прав');

	const files = await db.select({ url: videoFiles.url }).from(videoFiles).where(eq(videoFiles.videoId, videoId));
	for (const file of files) {
		try { await unlink(publicToPath(file.url) ?? ''); } catch {}
	}

	await db.delete(videos).where(eq(videos.id, videoId));
	await deleteUpload(video.videoUrl);
	await deleteUpload(video.thumbnail);
	try {
		await unlink(subtitlePath(videoId));
	} catch {
		// no subtitle file — ignore
	}

	return json({ ok: true });
};
