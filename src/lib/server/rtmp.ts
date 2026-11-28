import NodeMediaServer from 'node-media-server';
import ffmpegPath from 'ffmpeg-static';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { user } from './db/auth.schema';
import { streams, streamMessages } from './db/schema';

type NmsSession = {
	streamPath?: string;
	broadcast?: { publishGraceMs?: number };
};

declare global {
	// eslint-disable-next-line no-var
	var __vuetubeNms: NodeMediaServer | undefined;
}

const transcoders = new Map<string, ChildProcess>();

function hlsDir(key: string) {
	return path.resolve('data/hls', key.replace(/[^a-zA-Z0-9_-]/g, ''));
}

async function startTranscode(key: string) {
	if (!ffmpegPath || transcoders.has(key)) return;
	await mkdir(hlsDir(key), { recursive: true });
	const output = path.join(hlsDir(key), 'index.m3u8');
	const proc = spawn(
		ffmpegPath,
		[
			'-hide_banner', '-loglevel', 'error',
			'-i', `rtmp://127.0.0.1:1935/live/${key}`,
			'-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
			'-profile:v', 'baseline', '-level', '3.1', '-pix_fmt', 'yuv420p',
			'-c:a', 'aac', '-b:a', '64k',
			'-f', 'hls', '-hls_time', '4', '-hls_list_size', '4',
			'-hls_flags', 'delete_segments', '-hls_segment_filename',
			path.join(hlsDir(key), 'seg-%d.ts'), output
		],
		{ stdio: 'ignore' }
	);
	transcoders.set(key, proc);
	proc.on('close', () => transcoders.delete(key));
}

function stopTranscode(key: string) {
	const proc = transcoders.get(key);
	if (proc) {
		setTimeout(() => proc.kill(), 1500);
		transcoders.delete(key);
	}
}

async function syncLive(session: NmsSession, live: boolean) {
	const key = (session.streamPath ?? '').split('/').filter(Boolean).pop();
	if (!key) return;
	const [profile] = await db.select({ id: user.id }).from(user).where(eq(user.streamKey, key)).limit(1);
	if (!profile) return;
	const [stream] = await db.select({ id: streams.id }).from(streams).where(eq(streams.userId, profile.id)).limit(1);
	if (!stream) return;
	if (live) {
		// node-media-server waits 30s before emitting donePublish — shorten it so the
		// site flips offline promptly when OBS stops (still allows brief reconnects).
		if (session.broadcast) session.broadcast.publishGraceMs = 5000;
		// New broadcast session — clear chat left over from the previous stream
		await db.delete(streamMessages).where(eq(streamMessages.streamId, stream.id));
	}
	await db
		.update(streams)
		.set(live ? { isLive: true, startedAt: new Date(), endedAt: null } : { isLive: false, endedAt: new Date() })
		.where(eq(streams.userId, profile.id));
	if (live) await startTranscode(key);
	else stopTranscode(key);
}

export function startRtmpServer() {
	if (globalThis.__vuetubeNms) return;

	const nms = new NodeMediaServer({
		bind: '0.0.0.0',
		rtmp: { port: 1935, chunk_size: 60000, gop_cache: false, ping: 30, ping_timeout: 60 },
		http: { port: 8000, allow_origin: '*' },
		webadmin: { enable: false },
		store: { path: path.resolve('data/rtmp'), maxHistory: 1000 },
		auth: { play: false, publish: false }
	});

	nms.on('postPublish', (session: NmsSession) => syncLive(session, true).catch(() => {}));
	nms.on('donePublish', (session: NmsSession) => syncLive(session, false).catch(() => {}));

	try {
		nms.run();
		globalThis.__vuetubeNms = nms;
		console.log('RTMP server started on :1935, HLS transcoding enabled');
	} catch (cause) {
		console.error('RTMP server failed to start', cause);
	}
}
