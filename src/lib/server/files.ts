import { createWriteStream } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const UPLOAD_ROOT = path.resolve('data/uploads');

const EXTENSIONS: Record<string, string> = {
	'video/mp4': '.mp4',
	'video/webm': '.webm',
	'video/ogg': '.ogv',
	'video/quicktime': '.mov',
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/avif': '.avif'
};

export async function ensureUploadDirs() {
	await Promise.all([
		mkdir(path.join(UPLOAD_ROOT, 'videos'), { recursive: true }),
		mkdir(path.join(UPLOAD_ROOT, 'variants'), { recursive: true }),
		mkdir(path.join(UPLOAD_ROOT, 'thumbs'), { recursive: true }),
		mkdir(path.join(UPLOAD_ROOT, 'avatars'), { recursive: true }),
		mkdir(path.join(UPLOAD_ROOT, 'banners'), { recursive: true }),
		mkdir(path.join(UPLOAD_ROOT, 'subtitles'), { recursive: true })
	]);
}

function extensionFor(file: File, fallback: string): string {
	const fromType = EXTENSIONS[file.type];
	if (fromType) return fromType;
	const fromName = path.extname(file.name).toLowerCase();
	if (/^\.[a-z0-9]{2,5}$/.test(fromName)) return fromName;
	return fallback;
}

export async function saveUpload(file: File, folder: 'videos' | 'thumbs' | 'avatars' | 'banners'): Promise<string> {
	await ensureUploadDirs();
	const fallback = folder === 'videos' ? '.mp4' : '.jpg';
	const name = `${randomUUID()}${extensionFor(file, fallback)}`;
	const destination = path.join(UPLOAD_ROOT, folder, name);

	const stream = Readable.fromWeb(file.stream() as never);
	await pipeline(stream, createWriteStream(destination));

	return `/media/${folder}/${name}`;
}

export function subtitlePath(videoId: string): string {
	return path.join(UPLOAD_ROOT, 'subtitles', `${videoId.replace(/[^a-zA-Z0-9_-]/g, '')}.vtt`);
}

/** Automatically finds captions by video id or by the original file name. */
export async function findSubtitlePath(videoId: string, videoUrl: string): Promise<string | null> {
	const candidates = [subtitlePath(videoId)];
	const base = path.basename(videoUrl).replace(/\.[^.]+$/, '');
	const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '');
	if (safeBase) {
		candidates.push(path.join(UPLOAD_ROOT, 'subtitles', `${safeBase}.vtt`));
		candidates.push(path.join(UPLOAD_ROOT, 'videos', `${safeBase}.vtt`));
	}
	for (const candidate of candidates) {
		try {
			await access(candidate);
			return candidate;
		} catch {
			// try the next location
		}
	}
	return null;
}

export function publicToPath(publicPath: string): string | null {
	if (!publicPath.startsWith('/media/')) return null;
	const full = path.resolve(UPLOAD_ROOT, publicPath.slice('/media/'.length));
	return full.startsWith(UPLOAD_ROOT + path.sep) ? full : null;
}

export async function deleteUpload(publicPath: string | null | undefined) {
	if (!publicPath || !publicPath.startsWith('/media/')) return;
	const relative = publicPath.slice('/media/'.length);
	const full = path.resolve(UPLOAD_ROOT, relative);
	if (!full.startsWith(UPLOAD_ROOT + path.sep)) return;
	try {
		await unlink(full);
	} catch {
		// file already missing — ignore
	}
}

export const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
export const MAX_BANNER_SIZE = 20 * 1024 * 1024;
