import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { videoFiles, videos } from '#lib/server/db/schema';
import { qualityHeight, qualityLabel } from '#lib/utils/videoQuality';

export const GET: RequestHandler = async ({ params }) => {
	const [video] = await db
		.select({
			id: videos.id,
			url: videos.videoUrl,
			quality: videos.quality,
			width: videos.width,
			height: videos.height
		})
		.from(videos)
		.where(eq(videos.id, params.id))
		.limit(1);
	if (!video) throw error(404, 'Видео не найдено');

	const rows = await db
		.select({
			quality: videoFiles.quality,
			url: videoFiles.url,
			width: videoFiles.width,
			height: videoFiles.height
		})
		.from(videoFiles)
		.where(eq(videoFiles.videoId, video.id));

	const sourceHeight =
		qualityHeight(video.width, video.height) || Number(video.quality?.match(/(\d+)p/)?.[1] ?? 0);
	const sourceLabel =
		qualityLabel(video.width, video.height) || video.quality?.trim() || 'Оригинал';

	const variants = rows
		.map((variant) => {
			const height = qualityHeight(variant.width, variant.height) || variant.height;
			return { ...variant, qualityHeight: height };
		})
		// Legacy rows could contain upscaled renditions. Hide anything that is not
		// actually smaller than the source so the menu never offers fake quality.
		.filter((variant) => !sourceHeight || variant.qualityHeight < sourceHeight)
		// Best quality first — the same order people expect from YouTube.
		.sort((a, b) => b.qualityHeight - a.qualityHeight);

	return json({
		qualities: [
			{
				quality: sourceLabel,
				url: video.url,
				width: video.width,
				height: video.height,
				qualityHeight: sourceHeight,
				source: true
			},
			...variants.map((variant) => ({
				quality: variant.quality,
				url: variant.url,
				width: variant.width,
				height: variant.height,
				qualityHeight: variant.qualityHeight,
				source: false
			}))
		]
	});
};
