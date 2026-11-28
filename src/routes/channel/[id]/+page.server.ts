import { error } from '@sveltejs/kit';
import { getChannel, getChannelVideos, getLiveStreams, isSubscribed } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const channel = await getChannel(params.id);
	if (!channel) throw error(404, 'Канал не найден');

	const isOwner = locals.user?.id === channel.id;
	const videos = await getChannelVideos(channel.id, isOwner);
	const subscribed =
		locals.user && !isOwner ? await isSubscribed(locals.user.id, channel.id) : false;
	const tab = url.searchParams.get('tab') === 'about' ? 'about' : 'videos';

	return { channel, videos, liveStreams: await getLiveStreams(channel.id), isOwner, subscribed, tab };
};
