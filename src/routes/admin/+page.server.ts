import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/server/db';
import {
	adminActions,
	commentReports,
	comments,
	copyrightClaims,
	siteVisits,
	streams,
	user,
	videoFiles,
	videoReports,
	videos
} from '#lib/server/db/schema';
import { isAdmin } from '#lib/server/admin';
import { upholdClaim } from '#lib/server/copyright';
import { publicToPath, subtitlePath } from '#lib/server/files';

function guard(locals: App.Locals) {
	if (!locals.user || !isAdmin(locals.user.email)) throw error(403, 'Доступ запрещён');
}

async function log(adminId: string, action: string, targetId: string | null, detail: string) {
	await db.insert(adminActions).values({ id: randomUUID(), adminId, action, targetId, detail });
}

async function removeVideoFiles(videoId: string) {
	const files = await db.select({ url: videoFiles.url }).from(videoFiles).where(eq(videoFiles.videoId, videoId));
	for (const file of files) {
		try {
			await unlink(publicToPath(file.url) ?? '');
		} catch {
			// already gone
		}
	}
	try {
		await unlink(subtitlePath(videoId));
	} catch {
		// no captions
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	guard(locals);

	const [visits] = await db
		.select({
			count: sql<number>`count(*)`,
			unique: sql<number>`count(distinct ${siteVisits.userId})`
		})
		.from(siteVisits)
		.where(sql`${siteVisits.createdAt} >= unixepoch() - 86400`);

	const [regs] = await db
		.select({
			today: sql<number>`sum(case when ${user.createdAt} >= unixepoch() - 86400 then 1 else 0 end)`,
			total: sql<number>`count(*)`,
			frozen: sql<number>`sum(case when ${user.bannedUntil} > unixepoch() then 1 else 0 end)`
		})
		.from(user);

	const [videoStats] = await db
		.select({
			total: sql<number>`count(*)`,
			views: sql<number>`coalesce(sum(${videos.viewCount}), 0)`,
			hidden: sql<number>`sum(case when ${videos.visibility} = 'private' then 1 else 0 end)`,
			claimed: sql<number>`sum(case when ${videos.copyrightStatus} = 'claimed' then 1 else 0 end)`
		})
		.from(videos);

	const [liveStats] = await db
		.select({ live: sql<number>`sum(case when ${streams.isLive} = 1 then 1 else 0 end)` })
		.from(streams);

	const [reportStats] = await db
		.select({ pending: sql<number>`sum(case when ${videoReports.status} = 'pending' then 1 else 0 end)` })
		.from(videoReports);

	const [commentStats] = await db.select({ count: sql<number>`count(*)` }).from(comments);

	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			verified: user.verified,
			creator: user.creator,
			bannedUntil: user.bannedUntil,
			banReason: user.banReason,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(desc(user.createdAt))
		.limit(200);

	const claims = await db
		.select({
			id: copyrightClaims.id,
			videoId: copyrightClaims.videoId,
			type: copyrightClaims.type,
			status: copyrightClaims.status,
			reason: copyrightClaims.reason,
			createdAt: copyrightClaims.createdAt,
			videoTitle: videos.title,
			claimant: user.name
		})
		.from(copyrightClaims)
		.innerJoin(videos, eq(copyrightClaims.videoId, videos.id))
		.innerJoin(user, eq(copyrightClaims.claimantId, user.id))
		.orderBy(desc(copyrightClaims.createdAt))
		.limit(100);

	const content = await db
		.select({
			id: videos.id,
			title: videos.title,
			thumbnail: videos.thumbnail,
			visibility: videos.visibility,
			copyrightStatus: videos.copyrightStatus,
			viewCount: videos.viewCount,
			likeCount: videos.likeCount,
			duration: videos.duration,
			publishedAt: videos.publishedAt,
			author: user.name,
			authorEmail: user.email,
			userId: videos.userId
		})
		.from(videos)
		.innerJoin(user, eq(videos.userId, user.id))
		.orderBy(desc(videos.publishedAt))
		.limit(300);

	const reports = await db
		.select({
			id: videoReports.id,
			reason: videoReports.reason,
			detail: videoReports.detail,
			status: videoReports.status,
			createdAt: videoReports.createdAt,
			videoId: videoReports.videoId,
			videoTitle: videos.title,
			reporter: user.name
		})
		.from(videoReports)
		.innerJoin(videos, eq(videoReports.videoId, videos.id))
		.innerJoin(user, eq(videoReports.userId, user.id))
		.orderBy(desc(videoReports.createdAt))
		.limit(100);

	const commentReportsList = await db
		.select({
			id: commentReports.id,
			reason: commentReports.reason,
			createdAt: commentReports.createdAt,
			commentId: commentReports.commentId,
			content: comments.content,
			videoId: comments.videoId,
			reporter: user.name
		})
		.from(commentReports)
		.innerJoin(comments, eq(commentReports.commentId, comments.id))
		.innerJoin(user, eq(commentReports.userId, user.id))
		.orderBy(desc(commentReports.createdAt))
		.limit(100);

	const logRows = await db
		.select({
			id: adminActions.id,
			action: adminActions.action,
			targetId: adminActions.targetId,
			detail: adminActions.detail,
			createdAt: adminActions.createdAt,
			admin: user.name
		})
		.from(adminActions)
		.innerJoin(user, eq(adminActions.adminId, user.id))
		.orderBy(desc(adminActions.createdAt))
		.limit(100);

	return {
		stats: {
			visits: Number(visits?.count ?? 0),
			uniqueVisitors: Number(visits?.unique ?? 0),
			registrationsToday: Number(regs?.today ?? 0),
			usersTotal: Number(regs?.total ?? 0),
			frozen: Number(regs?.frozen ?? 0),
			videos: Number(videoStats?.total ?? 0),
			views: Number(videoStats?.views ?? 0),
			hidden: Number(videoStats?.hidden ?? 0),
			claimed: Number(videoStats?.claimed ?? 0),
			live: Number(liveStats?.live ?? 0),
			pendingReports: Number(reportStats?.pending ?? 0),
			comments: Number(commentStats?.count ?? 0)
		},
		users: users.map((u) => ({
			...u,
			createdAt: u.createdAt.toISOString(),
			bannedUntil: u.bannedUntil ? u.bannedUntil.toISOString() : null
		})),
		claims: claims.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
		content: content.map((v) => ({ ...v, publishedAt: v.publishedAt.toISOString() })),
		reports: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
		commentReports: commentReportsList.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
		activity: logRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))
	};
};

export const actions: Actions = {
	freeze: async ({ request, locals }) => {
		guard(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const days = Math.min(365, Math.max(1, Number(form.get('days') ?? 7)));
		const reason = String(form.get('reason') ?? '').trim().slice(0, 200) || 'Нарушение правил сообщества';
		if (!id) return fail(400, { message: 'Не выбран пользователь' });
		await db
			.update(user)
			.set({ bannedUntil: new Date(Date.now() + days * 86_400_000), banReason: reason })
			.where(eq(user.id, id));
		await log(locals.user!.id, 'freeze', id, `${days} дн. · ${reason}`);
		return { ok: true, message: 'Пользователь заморожен' };
	},
	unfreeze: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбран пользователь' });
		await db.update(user).set({ bannedUntil: null, banReason: null }).where(eq(user.id, id));
		await log(locals.user!.id, 'unfreeze', id, 'Доступ восстановлен');
		return { ok: true, message: 'Пользователь разморожен' };
	},
	creator: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбран пользователь' });
		const [row] = await db.select({ creator: user.creator }).from(user).where(eq(user.id, id)).limit(1);
		await db.update(user).set({ creator: !row?.creator }).where(eq(user.id, id));
		await log(locals.user!.id, 'creator', id, row?.creator ? 'Создатель снят' : 'Выдан статус создателя');
		return { ok: true };
	},
	verify: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбран пользователь' });
		const [row] = await db.select({ verified: user.verified }).from(user).where(eq(user.id, id)).limit(1);
		await db.update(user).set({ verified: !row?.verified }).where(eq(user.id, id));
		await log(locals.user!.id, 'verify', id, row?.verified ? 'Галочка снята' : 'Верификация выдана');
		return { ok: true };
	},
	hideVideo: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбрано видео' });
		await db.update(videos).set({ visibility: 'private' }).where(eq(videos.id, id));
		await log(locals.user!.id, 'hide_video', id, 'Видео скрыто из ленты');
		return { ok: true, message: 'Видео скрыто' };
	},
	unhideVideo: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбрано видео' });
		await db.update(videos).set({ visibility: 'public' }).where(eq(videos.id, id));
		await log(locals.user!.id, 'unhide_video', id, 'Видео снова публичное');
		return { ok: true, message: 'Видео восстановлено' };
	},
	claimVideo: async ({ request, locals }) => {
		guard(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const reason = String(form.get('reason') ?? '').trim().slice(0, 200) || 'Нарушение авторских прав';
		if (!id) return fail(400, { message: 'Не выбрано видео' });
		await db.update(videos).set({ copyrightStatus: 'claimed' }).where(eq(videos.id, id));
		await log(locals.user!.id, 'claim_video', id, reason);
		return { ok: true, message: 'Видео заблокировано по авторским правам' };
	},
	unclaimVideo: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбрано видео' });
		await db.update(videos).set({ copyrightStatus: 'none' }).where(eq(videos.id, id));
		await log(locals.user!.id, 'unclaim_video', id, 'Блокировка снята');
		return { ok: true, message: 'Блокировка снята' };
	},
	deleteVideo: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбрано видео' });
		const [video] = await db
			.select({ videoUrl: videos.videoUrl, thumbnail: videos.thumbnail })
			.from(videos)
			.where(eq(videos.id, id))
			.limit(1);
		if (!video) return fail(404, { message: 'Видео не найдено' });
		await removeVideoFiles(id);
		try {
			await unlink(publicToPath(video.videoUrl) ?? '');
		} catch {}
		if (video.thumbnail) {
			try {
				await unlink(publicToPath(video.thumbnail) ?? '');
			} catch {}
		}
		await db.delete(videos).where(eq(videos.id, id));
		await log(locals.user!.id, 'delete_video', id, 'Видео и файлы удалены');
		return { ok: true, message: 'Видео удалено' };
	},
	resolveReport: async ({ request, locals }) => {
		guard(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const videoId = String(form.get('videoId') ?? '');
		const hide = form.get('hide') === '1';
		if (!id) return fail(400, { message: 'Не выбрана жалоба' });
		await db
			.update(videoReports)
			.set({ status: 'resolved' })
			.where(eq(videoReports.id, id));
		if (hide && videoId) {
			await db.update(videos).set({ visibility: 'private' }).where(eq(videos.id, videoId));
		}
		await log(locals.user!.id, 'resolve_report', id, hide ? 'Жалоба принята, видео скрыто' : 'Жалоба принята');
		return { ok: true, message: 'Жалоба обработана' };
	},
	rejectReport: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбрана жалоба' });
		await db.update(videoReports).set({ status: 'rejected' }).where(eq(videoReports.id, id));
		await log(locals.user!.id, 'reject_report', id, 'Жалоба отклонена');
		return { ok: true };
	},
	deleteComment: async ({ request, locals }) => {
		guard(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const commentId = String(form.get('commentId') ?? '');
		if (!commentId) return fail(400, { message: 'Комментарий не найден' });
		await db.delete(comments).where(eq(comments.id, commentId));
		if (id) await db.delete(commentReports).where(eq(commentReports.id, id));
		await log(locals.user!.id, 'delete_comment', commentId, 'Комментарий удалён модератором');
		return { ok: true, message: 'Комментарий удалён' };
	},
	uphold: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбрана жалоба' });
		await upholdClaim(id);
		await log(locals.user!.id, 'uphold_claim', id, 'Жалоба удовлетворена');
		return { ok: true, message: 'Жалоба удовлетворена' };
	},
	reject: async ({ request, locals }) => {
		guard(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'Не выбрана жалоба' });
		await db
			.update(copyrightClaims)
			.set({ status: 'rejected', resolvedAt: new Date() })
			.where(and(eq(copyrightClaims.id, id)));
		await log(locals.user!.id, 'reject_claim', id, 'Жалоба отклонена');
		return { ok: true };
	},
	clearLog: async ({ locals }) => {
		guard(locals);
		await db.delete(adminActions);
		return { ok: true, message: 'Журнал очищен' };
	}
};
