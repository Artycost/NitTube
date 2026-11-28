/**
 * Real video quality is defined by the shorter side of the frame:
 * 640×360 and 360×640 are both 360p, 1920×1080 and 1080×1920 are both 1080p.
 * That is how YouTube labels portrait videos and it prevents upscaled "fake"
 * variants for vertical Shorts.
 */
export function qualityHeight(width: number, height: number): number {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
	return Math.round(Math.min(width, height));
}

const NAMED_LABELS: Record<number, string> = {
	144: '144p',
	240: '240p',
	360: '360p',
	480: '480p',
	720: '720p HD',
	1080: '1080p HD',
	1440: '1440p HD',
	2160: '2160p 4K',
	4320: '4320p 8K'
};

/** Exact, honest label — non-standard sizes keep their real height (e.g. 540p). */
export function qualityLabel(width: number, height: number): string {
	const value = qualityHeight(width, height);
	if (!value) return '';
	return NAMED_LABELS[value] ?? `${value}p`;
}
