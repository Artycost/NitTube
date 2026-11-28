import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';

const ROOT = path.resolve('data/hls');

export const GET: RequestHandler = async ({ params }) => {
	const relative = params.path ?? '';
	if (!relative || relative.includes('..') || relative.includes('\0')) throw error(404);
	const full = path.resolve(ROOT, relative);
	if (!full.startsWith(ROOT + path.sep)) throw error(404);

	let info;
	try {
		info = await stat(full);
	} catch {
		throw error(404);
	}
	if (!info.isFile()) throw error(404);

	const ext = path.extname(full).toLowerCase();
	const type = ext === '.m3u8' ? 'application/vnd.apple.mpegurl' : ext === '.ts' ? 'video/mp2t' : 'application/octet-stream';

	return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
		headers: {
			'Content-Type': type,
			'Cache-Control': 'no-cache',
			'Accept-Ranges': 'bytes'
		}
	});
};
