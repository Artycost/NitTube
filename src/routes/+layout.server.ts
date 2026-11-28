import { getSubscribedChannels, getSubscriptionFeed } from '#lib/server/queries';
import { isBanned, unbanExpired } from '#lib/server/moderation';
import { isAdmin } from '#lib/server/admin';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const authUser = locals.user;

	const banned = authUser
		? (authUser as unknown as { bannedUntil?: Date | null }).bannedUntil
		: null;

	const user = authUser
		? {
				id: authUser.id,
				name: authUser.name,
				email: authUser.email,
				image: authUser.image ?? null,
				verified: Boolean((authUser as { verified?: boolean }).verified),
				creator: Boolean((authUser as { creator?: boolean }).creator),
				bannedUntil: banned ? new Date(banned).toISOString() : null
			}
		: null;

	const subscriptions = user ? await getSubscribedChannels(user.id) : [];
	let ban = { banned: false, daysLeft: 0, reason: '' };
	if (user) {
		await unbanExpired(user.id);
		ban = await isBanned(user.id);
	}

	const feed = user ? await getSubscriptionFeed(user.id) : [];
	const notifications = feed
		.filter((video) => new Date(video.createdAt).getTime() > Date.now() - 7 * 86_400_000)
		.slice(0, 6)
		.map((video) => ({ id: video.id, title: video.title, channel: video.user.name, thumbnail: video.thumbnail }));
	return { user, subscriptions, ban, notifications, isAdmin: isAdmin(locals.user?.email) };
};
