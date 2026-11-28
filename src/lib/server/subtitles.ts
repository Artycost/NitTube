import { spawn } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { env, pipeline } from '@huggingface/transformers';
import { ensureUploadDirs, publicToPath, subtitlePath } from './files';

env.allowLocalModels = false;

type Transcriber = (audio: Float32Array, options: Record<string, unknown>) => Promise<{
	text: string;
	chunks?: { timestamp?: [number, number] | null; text: string }[];
}>;

let transcriberPromise: Promise<Transcriber> | null = null;

function getTranscriber(): Promise<Transcriber> {
	if (!transcriberPromise) {
		transcriberPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-medium', {
			dtype: 'q8'
		}) as Promise<Transcriber>;
	}
	return transcriberPromise;
}

function escapeVtt(text: string) {
	return text
		.replace(/-->/g, '→')
		.replace(/\r?\n/g, ' ')
		// Whisper tends to repeat short phrases on music — keep one copy.
		.replace(/(.{2,40}?)\s*(?:\1\s*){2,}/gi, '$1')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function vttTime(seconds: number) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	const ms = Math.floor((seconds % 1) * 1000);
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/** Extracts 16 kHz mono PCM so the speech model can read the audio. */
async function extractAudio(videoUrl: string, target: string): Promise<boolean> {
	const source = publicToPath(videoUrl);
	if (!source || !ffmpegPath) return false;
	await new Promise<void>((resolve, reject) => {
		const proc = spawn(
			ffmpegPath as string,
			['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', '-i', source, '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', target],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let err = '';
		proc.stderr?.on('data', (chunk: Buffer) => (err += chunk.toString()));
		proc.on('error', reject);
		proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-400) || `ffmpeg ${code}`))));
	});
	return true;
}

/** Automatically creates a WebVTT track from the video's own audio. */
export async function transcribeSubtitles(videoId: string, videoUrl: string): Promise<boolean> {
	await ensureUploadDirs();
	const raw = path.join(path.dirname(subtitlePath(videoId)), `${videoId}.raw`);
	try {
		if (!(await extractAudio(videoUrl, raw))) return false;
		const buffer = await readFile(raw);
		const int16 = new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
		if (!int16.length) return false;
		const audio = new Float32Array(int16.length);
		for (let i = 0; i < int16.length; i++) audio[i] = int16[i] / 32768;

		const transcriber = await getTranscriber();
		const result = await transcriber(audio, {
			language: 'russian',
			task: 'transcribe',
			chunk_length_s: 30,
			stride_length_s: 5,
			return_timestamps: true
		});

		const chunks: string[] = [];
		for (const chunk of result.chunks ?? []) {
			const [start, end] = chunk.timestamp ?? [0, 0];
			let text = escapeVtt(chunk.text);
			if (!text) continue;
			if (text.length > 140) text = `${text.slice(0, 137)}…`;
			let from = start ?? 0;
			const to = end ?? from;
			while (from < to) {
				const next = Math.min(to, from + 6);
				chunks.push(`${vttTime(from)} --> ${vttTime(next)}\n${text}\n`);
				from = next;
			}
		}
		if (!chunks.length) return false;

		const vtt = `WEBVTT\n\n${chunks.join('\n')}`;
		await writeFile(subtitlePath(videoId), vtt, 'utf8');
		return true;
	} catch (cause) {
		console.error('auto subtitles failed', cause);
		return false;
	} finally {
		await unlink(raw).catch(() => {});
	}
}
