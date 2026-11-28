import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import { db } from './db';
import { videoFiles } from './db/schema';
import { ensureUploadDirs, publicToPath, subtitlePath, UPLOAD_ROOT } from './files';
import { qualityHeight, qualityLabel } from '#lib/utils/videoQuality';

export const QUALITY_HEIGHTS = [144, 240, 360, 480, 720, 1080, 1440, 2160] as const;

export type MediaInfo = {
	width: number;
	height: number;
	qualityHeight: number;
	qualityLabel: string;
	duration: number;
	bitrate: number;
	videoBitrate: number;
	audioBitrate: number;
	videoCodec: string;
	audioCodec: string;
	compatible: boolean;
	hasMusic: boolean;
};

const EMPTY_MEDIA: MediaInfo = {
	width: 0,
	height: 0,
	qualityHeight: 0,
	qualityLabel: '',
	duration: 0,
	bitrate: 0,
	videoBitrate: 0,
	audioBitrate: 0,
	videoCodec: '',
	audioCodec: '',
	compatible: false,
	hasMusic: false
};

/** Upper bounds (kb/s) so a rendition never becomes bigger than the original. */
const BITRATE_CAPS: Record<number, number> = {
	144: 140,
	240: 280,
	360: 550,
	480: 900,
	720: 1800,
	1080: 3500,
	1440: 6000,
	2160: 12000
};

function runFfmpeg(args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!ffmpegPath) return reject(new Error('ffmpeg недоступен'));
		const bin = ffmpegPath as string;
		const proc = spawn(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', ...args]) as ChildProcess;
		let stderr = '';
		proc.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
		proc.on('error', reject);
		proc.on('close', (code) => {
			if (code === 0) resolve();
			else reject(new Error(stderr.slice(-500) || `ffmpeg exit ${code}`));
		});
	});
}

function probeOutput(source: string): Promise<string> {
	return new Promise((resolve) => {
		if (!ffmpegPath) return resolve('');
		const bin = ffmpegPath as string;
		const proc = spawn(bin, ['-hide_banner', '-nostdin', '-i', source]) as ChildProcess;
		let out = '';
		proc.stderr?.on('data', (chunk: Buffer) => (out += chunk.toString()));
		proc.on('error', () => resolve(out));
		proc.on('close', () => resolve(out));
	});
}

function even(value: number): number {
	return Math.max(2, Math.round(value / 2) * 2);
}

/** Dimensions of a variant whose shorter side equals `target`. */
export function variantDimensions(width: number, height: number, target: number) {
	if (width <= height) {
		return { width: target, height: even(target * (height / width)) };
	}
	return { width: even(target * (width / height)), height: target };
}

/**
 * Downscaled copies exist only for slow internet. Their bitrate is always
 * derived from the source so they stay smaller than the original file.
 */
function variantBitrate(sourceBitrate: number, sourceQuality: number, target: number) {
	const cap = BITRATE_CAPS[target] ?? 1000;
	if (sourceBitrate <= 0) {
		const audio = Math.min(96, Math.max(16, Math.round(cap * 0.12)));
		return { video: Math.max(24, cap - audio), audio };
	}
	const ratio = sourceQuality > 0 ? Math.min(1, target / sourceQuality) : 0.5;
	const total = Math.max(30, Math.min(cap, Math.round(sourceBitrate * (0.35 + 0.45 * ratio))));
	const audio = Math.max(16, Math.min(96, Math.round(Math.min(total * 0.2, 96))));
	return { video: Math.max(20, total - audio), audio };
}

/**
 * Reads the real dimensions and bitrate from the file itself. ffmpeg reports
 * coded dimensions, so portrait videos recorded with a rotation flag are
 * swapped back to their display orientation.
 */
export async function readMediaInfo(videoUrl: string): Promise<MediaInfo> {
	if (!ffmpegPath) return EMPTY_MEDIA;
	const source = publicToPath(videoUrl);
	if (!source) return EMPTY_MEDIA;

	const meta = await probeOutput(source);
	const lines = meta.split(/\r?\n/);
	const videoLine =
		lines.find((line) => /Stream #\d+:\d+.*Video:/i.test(line) && !/attached pic/i.test(line)) ??
		lines.find((line) => /Video:/i.test(line) && !/attached pic/i.test(line)) ??
		'';
	const dim = videoLine.match(/(\d{2,5})x(\d{2,5})/);
	let width = dim ? Number(dim[1]) : 0;
	let height = dim ? Number(dim[2]) : 0;
	const rotation = Number(meta.match(/rotation of (-?[\d.]+) degrees/)?.[1] ?? 0);
	if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];

	const durationMatch = meta.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
	const duration = durationMatch
		? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
		: 0;
	const bitrate = Number(meta.match(/bitrate:\s*(\d+)\s*kb\/s/i)?.[1] ?? 0);
	const videoBitrate = Number(videoLine.match(/(\d+)\s*kb\/s/i)?.[1] ?? 0);

	const audioLine = lines.find((line) => /Stream #\d+:\d+.*Audio:/i.test(line)) ?? '';
	const audioBitrate = Number(audioLine.match(/(\d+)\s*kb\/s/i)?.[1] ?? 0);
	const videoCodec = (videoLine.match(/Video:\s*([a-z0-9_-]+)/i)?.[1] ?? '').toLowerCase();
	const audioCodec = (audioLine.match(/Audio:\s*([a-z0-9_-]+)/i)?.[1] ?? '').toLowerCase();
	const containerLine = lines.find((line) => /^Input #0/i.test(line)) ?? '';
	const container = (containerLine.match(/Input #0,\s*([^,]+)/i)?.[1] ?? '').toLowerCase();
	const compatible =
		videoCodec === 'h264' &&
		(!audioCodec || audioCodec === 'aac' || audioCodec === 'mp3') &&
		(container.includes('mp4') || container.includes('mov') || container.includes('matroska'));
	// Only a full, high-quality stereo soundtrack counts as music — not a voice
	// track or a short sound effect (those are usually mono / low bitrate / short).
	const stereo = /stereo|5\.1|surround/i.test(audioLine);
	const hasMusic = Boolean(audioLine) && audioBitrate >= 128 && stereo && duration >= 20;

	return {
		width,
		height,
		qualityHeight: qualityHeight(width, height),
		qualityLabel: qualityLabel(width, height),
		duration,
		bitrate: bitrate || videoBitrate + audioBitrate,
		videoBitrate,
		audioBitrate,
		videoCodec,
		audioCodec,
		compatible,
		hasMusic
	};
}

/**
 * Browser compatibility check. Anything that cannot be played natively
 * (HEVC, AV1, unusual containers, exotic audio) is converted to H.264/AAC MP4.
 */
export async function ensureBrowserCompatible(
	videoId: string,
	videoUrl: string,
	info: MediaInfo
): Promise<{ url: string; info: MediaInfo }> {
	if (info.compatible || !ffmpegPath) return { url: videoUrl, info };
	const source = publicToPath(videoUrl);
	if (!source) return { url: videoUrl, info };

	const name = `${videoId}-compatible.mp4`;
	const output = path.join(UPLOAD_ROOT, 'videos', name);
	try {
		await runFfmpeg([
			'-i', source,
			'-c:v', 'libx264',
			'-preset', 'medium',
			'-crf', '20',
			'-pix_fmt', 'yuv420p',
			'-c:a', 'aac',
			'-b:a', '128k',
			'-movflags', '+faststart',
			output
		]);
		const convertedUrl = `/media/videos/${name}`;
		const convertedInfo = await readMediaInfo(convertedUrl);
		if (convertedInfo.width && convertedInfo.height) {
			await unlink(source).catch(() => {});
			return { url: convertedUrl, info: convertedInfo };
		}
	} catch (cause) {
		console.error('compatibility conversion failed', cause);
	}
	return { url: videoUrl, info };
}

/** True when the file contains a full, high-quality music track. */
export async function detectHasMusic(videoUrl: string): Promise<boolean> {
	return (await readMediaInfo(videoUrl)).hasMusic;
}

/** Pulls an embedded subtitle stream out of the video automatically, if one exists. */
export async function extractEmbeddedSubtitles(videoId: string, videoUrl: string): Promise<boolean> {
	if (!ffmpegPath) return false;
	const source = publicToPath(videoUrl);
	if (!source) return false;
	const meta = await probeOutput(source);
	if (!/Subtitle:/i.test(meta)) return false;
	await ensureUploadDirs();
	try {
		await runFfmpeg(['-i', source, '-map', '0:s:0', '-c:s', 'webvtt', subtitlePath(videoId)]);
		return true;
	} catch (cause) {
		console.error('subtitle extraction failed', cause);
		return false;
	}
}

export async function createQualityVariants(videoId: string, videoUrl: string, info?: MediaInfo) {
	if (!ffmpegPath) return [];
	await ensureUploadDirs();
	const source = publicToPath(videoUrl);
	if (!source) return [];

	const media = info ?? (await readMediaInfo(videoUrl));
	const sourceQuality = media.qualityHeight;
	if (!sourceQuality || !media.width || !media.height) return [];

	const created: { quality: string; url: string; width: number; height: number }[] = [];
	for (const target of QUALITY_HEIGHTS) {
		// Never upscale: the untouched original is the real quality.
		// These are only smaller copies for slow internet.
		if (target >= sourceQuality) continue;
		const { width, height } = variantDimensions(media.width, media.height, target);
		const { video, audio } = variantBitrate(media.bitrate, sourceQuality, target);
		const id = randomUUID();
		const filename = `${id}-${target}.mp4`;
		const output = path.join(UPLOAD_ROOT, 'variants', filename);
		try {
			await runFfmpeg([
				'-i', source,
				'-vf', `scale=${width}:${height}:flags=lanczos,setsar=1`,
				'-c:v', 'libx264',
				'-preset', 'medium',
				'-b:v', `${video}k`,
				'-maxrate', `${Math.round(video * 1.15)}k`,
				'-bufsize', `${Math.round(video * 2)}k`,
				'-profile:v', 'main',
				'-pix_fmt', 'yuv420p',
				'-c:a', 'aac',
				'-b:a', `${audio}k`,
				'-movflags', '+faststart',
				output
			]);
			const url = `/media/variants/${filename}`;
			await db.insert(videoFiles).values({ id, videoId, quality: `${target}p`, url, width, height });
			created.push({ quality: `${target}p`, url, width, height });
		} catch (cause) {
			console.error('transcode failed', target, cause);
		}
	}
	return created;
}
