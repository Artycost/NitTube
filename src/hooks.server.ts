import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { startRtmpServer } from '#lib/server/rtmp';

startRtmpServer();
import { db } from '#lib/server/db';
import { siteVisits } from '#lib/server/db/schema';
import { randomUUID } from 'node:crypto';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const path = event.url.pathname;
	if (!path.startsWith('/api') && !path.startsWith('/media') && !path.startsWith('/__')) {
		db.insert(siteVisits)
			.values({ id: randomUUID(), userId: event.locals.user?.id ?? null, path })
			.run()
			.catch(() => {});
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
