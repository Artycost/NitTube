import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { and, eq, gte } from 'drizzle-orm';
import { db } from './db';
import { copyrightClaims, copyrightReferences, copyrightStrikes, user, videos, videoFiles } from './db/schema';
import { publicToPath } from './files';

async function removeVideoFiles(videoId: string) {
	const [video] = await db
		.select({ videoUrl: videos.videoUrl, thumbnail: videos.thumbnail })
		.from(videos)
		.where(eq(videos.id, videoId))
		.limit(1);
	const files = await db.select({ url: videoFiles.url }).from(videoFiles).where(eq(videoFiles.videoId, videoId));
	const urls = [...files.map((f) => f.url), video?.videoUrl, video?.thumbnail].filter(Boolean) as string[];
	for (const url of urls) {
		try { await unlink(publicToPath(url) ?? ''); } catch {}
	}
}

export async function hashVideoFile(publicPath: string): Promise<string> {
	const full = publicToPath(publicPath);
	if (!full) return '';
	return new Promise((resolve, reject) => {
		const hash = createHash('sha256');
		const stream = createReadStream(full);
		stream.on('data', (chunk) => hash.update(chunk));
		stream.on('end', () => resolve(hash.digest('hex')));
		stream.on('error', reject);
	});
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
	return createHash('sha256').update(bytes).digest('hex');
}

export async function activeStrikes(userId: string): Promise<number> {
	const since = new Date(Date.now() - 90 * 86_400_000);
	const rows = await db
		.select({ id: copyrightStrikes.id })
		.from(copyrightStrikes)
		.where(and(eq(copyrightStrikes.userId, userId), gte(copyrightStrikes.createdAt, since)));
	return rows.length;
}

export async function addStrike(userId: string, videoId: string, reason: string) {
	await db.insert(copyrightStrikes).values({
		id: randomUUID(),
		userId,
		videoId,
		reason: reason.slice(0, 200)
	});

	const count = await activeStrikes(userId);
	if (count >= 3) {
		await db
			.update(user)
			.set({
				bannedUntil: new Date(Date.now() + 7 * 86_400_000),
				banReason: 'Блокировка за повторные нарушения авторских прав'
			})
			.where(eq(user.id, userId));
	}
	return count;
}

export async function checkAutoClaim(videoId: string, videoUrl: string, uploaderId: string) {
	const hash = await hashVideoFile(videoUrl);
	if (!hash) return null;

	const [match] = await db
		.select({ ownerId: copyrightReferences.ownerId, title: copyrightReferences.title })
		.from(copyrightReferences)
		.where(eq(copyrightReferences.hash, hash))
		.limit(1);

	if (!match || match.ownerId === uploaderId) return null;

	await db.insert(copyrightClaims).values({
		id: randomUUID(),
		videoId,
		claimantId: match.ownerId,
		type: 'auto',
		status: 'upheld',
		reason: `Совпадение с защищённым произведением «${match.title}»`,
		matchedHash: hash,
		resolvedAt: new Date()
	});
	await db
		.update(videos)
		.set({ copyrightStatus: 'claimed', visibility: 'private' })
		.where(eq(videos.id, videoId));
	await removeVideoFiles(videoId);
	await addStrike(uploaderId, videoId, `Автоматическое совпадение: ${match.title}`);
	return { title: match.title, hash };
}

export async function upholdClaim(claimId: string) {
	const [claim] = await db
		.select({ id: copyrightClaims.id, videoId: copyrightClaims.videoId, claimantId: copyrightClaims.claimantId, reason: copyrightClaims.reason, status: copyrightClaims.status })
		.from(copyrightClaims)
		.where(eq(copyrightClaims.id, claimId))
		.limit(1);
	if (!claim || claim.status !== 'pending') return null;

	await db
		.update(copyrightClaims)
		.set({ status: 'upheld', resolvedAt: new Date() })
		.where(eq(copyrightClaims.id, claimId));
	await db
		.update(videos)
		.set({ copyrightStatus: 'claimed', visibility: 'private' })
		.where(eq(videos.id, claim.videoId));
	await removeVideoFiles(claim.videoId);

	const [video] = await db.select({ userId: videos.userId }).from(videos).where(eq(videos.id, claim.videoId)).limit(1);
	if (video) await addStrike(video.userId, claim.videoId, claim.reason || 'Жалоба правообладателя');
	return claim;
}
