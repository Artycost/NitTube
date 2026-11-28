import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/server/db';
import { streams } from '#lib/server/db/schema';
import { user } from '#lib/server/db/auth.schema';
import { isBanned } from '#lib/server/moderation';

const key = () => randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8);
const text = (input: FormDataEntryValue | null) =>
	(input instanceof File ? '' : (input ?? '')).trim().slice(0, 120);

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/login');
	const ban = await isBanned(locals.user.id);

	const [profile] = await db
		.select({ streamKey: user.streamKey, name: user.name })
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);

	let streamKey = profile?.streamKey;
	if (!streamKey) {
		streamKey = key();
		await db.update(user).set({ streamKey }).where(eq(user.id, locals.user.id));
	}

	let [stream] = await db
		.select()
		.from(streams)
		.where(eq(streams.userId, locals.user.id))
		.orderBy(desc(streams.createdAt))
		.limit(1);

	if (!stream) {
		const id = randomUUID();
		await db.insert(streams).values({ id, userId: locals.user.id, title: '', category: 'Другое' });
		[stream] = await db.select().from(streams).where(eq(streams.id, id)).limit(1);
	}

	const originHost = url.hostname;

	return {
		stream: {
			id: stream!.id,
			title: stream!.title,
			category: stream!.category,
			isLive: stream!.isLive,
			viewers: stream!.viewers,
			startedAt: stream!.startedAt ? new Date(stream!.startedAt).toISOString() : null
		},
		streamKey,
		serverUrl: `rtmp://${originHost}:1935/live`,
		channelName: profile?.name ?? '',
		banned: ban
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const form = await request.formData();
		await db
			.update(streams)
			.set({ title: text(form.get('title')), category: text(form.get('category')) || 'Другое' })
			.where(eq(streams.userId, locals.user.id));
		return { ok: true };
	},
	start: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const ban = await isBanned(locals.user.id);
		if (ban.banned) return fail(403, { message: `Стрим заблокирован ещё ${ban.daysLeft} дн.` });
		await db
			.update(streams)
			.set({ isLive: true, viewers: 0, startedAt: new Date(), endedAt: null })
			.where(eq(streams.userId, locals.user.id));
		return { ok: true };
	},
	stop: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		await db
			.update(streams)
			.set({ isLive: false, endedAt: new Date() })
			.where(eq(streams.userId, locals.user.id));
		return { ok: true };
	},
	regenerate: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const streamKey = key();
		await db.update(user).set({ streamKey }).where(eq(user.id, locals.user.id));
		return { ok: true };
	},
	test: async () => {
		const ok = await new Promise<boolean>((resolve) => {
			const socket = net.connect(1935, '127.0.0.1');
			const done = (value: boolean) => {
				socket.destroy();
				resolve(value);
			};
			socket.setTimeout(2000);
			socket.on('connect', () => done(true));
			socket.on('timeout', () => done(false));
			socket.on('error', () => done(false));
		});
		return ok ? { ok: true, message: 'RTMP-сервер доступен на порту 1935' } : fail(503, { message: 'RTMP-сервер недоступен — перезапустите приложение' });
	}
};
