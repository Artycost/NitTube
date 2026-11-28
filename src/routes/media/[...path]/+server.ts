import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { UPLOAD_ROOT } from '#lib/server/files';
import type { RequestHandler } from './$types';

const MIME: Record<string, string> = {
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.ogv': 'video/ogg',
	'.mov': 'video/quicktime',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.avif': 'image/avif'
};

function resolveFile(relative: string) {
	const full = path.resolve(UPLOAD_ROOT, relative);
	if (!full.startsWith(UPLOAD_ROOT + path.sep)) throw error(404, 'Not found');
	return full;
}

export const GET: RequestHandler = async ({ params, request }) => {
	const relative = params.path ?? '';
	if (!relative || relative.includes('..') || relative.includes('\0')) {
		throw error(404, 'Not found');
	}

	const full = resolveFile(relative);

	let info;
	try {
		info = await stat(full);
	} catch {
		throw error(404, 'Not found');
	}
	if (!info.isFile()) throw error(404, 'Not found');

	const contentType = MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream';
	const range = request.headers.get('range');

	if (range) {
		const match = /bytes=(\d*)-(\d*)/.exec(range);
		if (match) {
			const start = match[1] ? Number.parseInt(match[1], 10) : 0;
			let end = match[2] ? Number.parseInt(match[2], 10) : info.size - 1;

			if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= info.size) {
				return new Response(null, {
					status: 416,
					headers: { 'Content-Range': `bytes */${info.size}` }
				});
			}

			end = Math.min(end, info.size - 1);
			const stream = createReadStream(full, { start, end });

			return new Response(Readable.toWeb(stream) as ReadableStream, {
				status: 206,
				headers: {
					'Content-Type': contentType,
					'Content-Length': String(end - start + 1),
					'Content-Range': `bytes ${start}-${end}/${info.size}`,
					'Accept-Ranges': 'bytes',
					'Cache-Control': 'public, max-age=31536000, immutable'
				}
			});
		}
	}

	const stream = createReadStream(full);

	return new Response(Readable.toWeb(stream) as ReadableStream, {
		headers: {
			'Content-Type': contentType,
			'Content-Length': String(info.size),
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
