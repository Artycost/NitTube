<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toasts } from '#lib/stores/toast.svelte';
	import { formatDate, formatSubscribers, formatViews, timeAgo } from '#lib/utils/format';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import VideoPlayer from '#lib/components/VideoPlayer.svelte';
	import VerifiedBadge from '#lib/components/VerifiedBadge.svelte';
	import VideoRow from '#lib/components/VideoRow.svelte';
	import ShortsShelf from '#lib/components/ShortsShelf.svelte';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import LikeButtons from '#lib/components/LikeButtons.svelte';
	import SubscribeButton from '#lib/components/SubscribeButton.svelte';
	import CommentSection from '#lib/components/CommentSection.svelte';
	import FormattedDescription from '#lib/components/FormattedDescription.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let theater = $state(false);
	let descriptionOpen = $state(false);
	let deleteOpen = $state(false);

	let chatMessages = $state<{ id: string; content: string; name: string; image: string | null; createdAt: string }[]>([]);
	let chatText = $state('');
	let liveIsOn = $state(false);
	let liveViewers = $state(0);

	async function loadChat() {
		if (!data.live) return;
		const id = data.live.id;
		const res = await fetch(`/api/streams/${id}/messages`);
		if (res.ok && data.live?.id === id) chatMessages = (await res.json()).messages;
	}

	async function sendChat() {
		if (!data.live || !chatText.trim()) return;
		const text = chatText.trim();
		chatText = '';
		const res = await fetch(`/api/streams/${data.live.id}/messages`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ content: text })
		});
		if (res.ok) await loadChat();
	}

	$effect(() => {
		const id = data.live?.id;
		if (!id) return;
		chatMessages = [];
		liveIsOn = data.live!.isLive;
		liveViewers = data.live!.viewers;
		loadChat();
	});

	onMount(() => {
		if (!data.live) return;
		loadChat();
		const timer = setInterval(async () => {
			if (!data.live) return;
			const res = await fetch(`/api/streams/${data.live.id}/status`);
			if (res.ok) {
				const status = await res.json();
				const justWentLive = !liveIsOn && status.isLive;
				liveIsOn = status.isLive;
				liveViewers = status.viewers;
				if (justWentLive) chatMessages = [];
			}
			loadChat();
		}, 4000);
		return () => clearInterval(timer);
	});


	const video = $derived(data.video ?? ({} as NonNullable<PageData['video']>));
	const user = $derived(page.data.user);
	const bigVideos = $derived(data.recommendations.filter((item) => !item.isShort));
	const shortVideos = $derived(data.recommendations.filter((item) => item.isShort));

	async function share() {
		const url = `${location.origin}/watch/${video.id}`;
		try {
			await navigator.clipboard.writeText(url);
			toasts.success('Ссылка скопирована');
		} catch {
			toasts.error('Не удалось скопировать ссылку');
		}
	}

	let reportOpen = $state(false);
	let reportReason = $state('');

	async function submitCopyright() {
		if (!reportReason.trim()) return;
		const res = await fetch(`/api/videos/${video.id}/copyright`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ reason: reportReason.trim() })
		});
		if (res.ok) {
			toasts.success('Жалоба отправлена правообладателю на рассмотрение');
			reportOpen = false;
			reportReason = '';
		} else {
			const data = await res.json().catch(() => ({}));
			toasts.error(data.message ?? 'Не удалось отправить жалобу');
		}
	}

	async function deleteVideo() {
		try {
			const response = await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('failed');
			toasts.success('Видео удалено');
			goto(`/channel/${video.userId}`);
		} catch {
			toasts.error('Не удалось удалить видео');
		}
	}
</script>

<svelte:head>
	<title>{data.live ? data.live.title || 'Трансляция' : video.title} — VueTube</title>
	<meta name="description" content={data.live ? 'Прямая трансляция на VueTube' : (video.description?.slice(0, 160) ?? video.title)} />
</svelte:head>

{#if data.live}
	<div class="mx-auto max-w-[1750px] px-3 py-4 sm:px-6 sm:py-5 fade-in">
		<div class="grid grid-cols-1 gap-x-6 gap-y-8 xl:grid-cols-[minmax(0,1fr)_402px]">
			<div class="min-w-0">
				<div class="overflow-hidden rounded-xl bg-black">
					<VideoPlayer src={data.live.hlsUrl} videoId={data.live.id} live edgeToEdge />
				</div>

				<h1 class="font-display mt-4 text-[20px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[22px]">
					{data.live.title || 'Прямая трансляция'}
				</h1>

				<div class="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-(--bg-elevated) p-4">
					<a href="/channel/{data.live.userId}"><Avatar name={data.live.channelName} image={data.live.channelImage} id={data.live.userId} size={40} /></a>
					<div class="min-w-0">
						<p class="truncate text-[14px] font-bold">{data.live.channelName}</p>
						<p class="text-[12px] text-(--text-secondary)">{data.live.category}</p>
					</div>
					<span class="ml-auto inline-flex items-center gap-2 rounded-[10px] bg-(--bg-subtle) px-3 py-1.5 text-[11px] font-bold">
						<span class="h-2 w-2 rounded-full bg-(--text)"></span>
						{liveIsOn ? 'В ЭФИРЕ' : 'НЕ В ЭФИРЕ'} · {formatViews(liveViewers)}
					</span>
				</div>

			</div>

			<aside class="flex min-w-0 flex-col gap-4">
				<div class="rounded-xl bg-(--bg-elevated) p-4 text-[13px] leading-relaxed text-(--text-secondary)">
					<p>Прямой эфир на VueTube. Подключите видеокодер в студии, чтобы начать вещание.</p>
					<p class="mt-3 text-[12px] text-(--text-tertiary)">Категория: {data.live.category}</p>
					<p class="mt-1 text-[12px] text-(--text-tertiary)">Зрителей: {formatViews(data.live.viewers)}</p>
				</div>

				<div class="flex min-h-[360px] flex-1 flex-col rounded-xl bg-(--bg-elevated)">
					<div class="flex items-center justify-between px-4 py-3">
						<h2 class="font-display text-[15px] font-bold">Чат трансляции</h2>
						<Icon name="message" size={17} class="text-(--text-tertiary)" />
					</div>
					<div class="flex-1 space-y-3 overflow-y-auto px-4 pb-3 no-scrollbar">
						{#each chatMessages as message (message.id)}
							<div class="flex gap-2 text-[12px]">
								<Avatar name={message.name} image={message.image} id={message.id} size={24} />
								<p class="min-w-0"><strong class="font-bold">{message.name}</strong> {message.content}</p>
							</div>
						{:else}
							<p class="py-8 text-center text-[12px] text-(--text-tertiary)">Напишите первое сообщение</p>
						{/each}
					</div>
					{#if user}
						<form class="flex gap-2 border-t border-(--border) p-3" onsubmit={(e) => { e.preventDefault(); sendChat(); }}>
							<input bind:value={chatText} class="field h-10 min-w-0 flex-1 px-3 text-[12px]" placeholder="Сообщение в чат" />
							<button type="submit" class="icon-btn" aria-label="Отправить"><Icon name="send" size={17} /></button>
						</form>
					{:else}
						<a href="/login" class="btn-secondary m-3 h-10 text-[12px]">Войдите, чтобы писать в чат</a>
					{/if}
				</div>
			</aside>
		</div>
	</div>
{:else}
<div class="mx-auto w-full max-w-[1800px] px-2 py-2 sm:px-4 sm:py-3">
	<div class={theater ? '' : 'grid grid-cols-1 gap-x-5 gap-y-8 xl:grid-cols-[minmax(0,1fr)_380px]'}>
		<div class="relative min-w-0">
			<div class="relative overflow-hidden rounded-xl bg-black">
				{#if video.copyrightStatus === 'claimed'}
					<div class="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center text-white">
						<span class="flex h-14 w-14 items-center justify-center rounded-[16px] bg-white/10"><Icon name="lock" size={28} /></span>
						<p class="text-[16px] font-bold">Видео заблокировано по авторским правам</p>
						<p class="max-w-sm text-[12px] text-white/60">Загруженное видео совпало с защищённым произведением. Владелец контента получил уведомление.</p>
					</div>
				{:else}
					<VideoPlayer
						src={video.videoUrl}
						poster={video.thumbnail}
						videoId={video.id}
						initialProgress={data.progress}
						quality={video.quality}
						canEdit={data.isOwner}
						edgeToEdge
						ontheater={() => (theater = !theater)}
					/>
				{/if}
			</div>

			<div class="px-2 sm:px-3">
			<h1 class="font-display mt-4 text-[20px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[22px]">
				{video.title}
			</h1>

			<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<a href="/channel/{video.user.id}" class="shrink-0">
						<Avatar name={video.user.name} image={video.user.image} id={video.user.id} size={42} />
					</a>
					<div class="min-w-0">
						<a href="/channel/{video.user.id}" class="flex items-center gap-1 text-[15px] font-semibold hover:text-(--accent)">
							<span class="truncate">{video.user.name}</span>
							{#if video.user.verified}
								<VerifiedBadge size={14} />
							{/if}
						</a>
						<p class="text-xs text-(--text-secondary)">{formatSubscribers(video.subscriberCount)}</p>
					</div>

					{#if !data.isOwner}
						<div class="ml-1">
							<SubscribeButton
								channelId={video.user.id}
								subscribed={data.subscribed}
								count={video.subscriberCount}
								showCount={false}
							/>
						</div>
					{:else}
						<a href="/edit/{video.id}" class="btn-secondary ml-1 h-9 px-3.5 text-[13px]">
							<Icon name="edit" size={15} />
							Настроить видео
						</a>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<LikeButtons
						videoId={video.id}
						likes={video.likeCount}
						dislikes={video.dislikeCount}
						reaction={data.reaction}
					/>

					<button class="btn-secondary h-9 px-3.5 text-[13px]" onclick={share}>
						<Icon name="share" size={17} />
						<span class="hidden sm:inline">Поделиться</span>
					</button>

					<button class="btn-secondary h-9 px-3.5 text-[13px]" onclick={() => (reportOpen = !reportOpen)}>
						<Icon name="info" size={17} />
						<span class="hidden sm:inline">Авторские права</span>
					</button>

					{#if reportOpen}
						<div class="w-full rounded-[14px] bg-(--bg-elevated) p-4">
							<p class="mb-2 text-[12px] font-bold">Жалоба на нарушение авторских прав</p>
							<textarea bind:value={reportReason} rows="3" class="field h-auto w-full resize-none px-3 py-2 text-[12px]" placeholder="Опишите, какие права нарушены и чем именно"></textarea>
							<button class="btn-primary mt-2 h-9 px-4 text-[12px]" onclick={submitCopyright}>Отправить жалобу</button>
						</div>
					{/if}

					{#if data.isOwner}
						<button class="btn-secondary h-9 px-3.5 text-[13px] text-red-500" onclick={() => (deleteOpen = true)}>
							<Icon name="trash" size={16} />
							<span class="hidden sm:inline">Удалить</span>
						</button>
					{/if}
				</div>
			</div>

			<div class="mt-4 rounded-xl bg-(--bg-subtle) p-3.5 text-sm">
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
					<span>{formatViews(video.viewCount)}</span>
					<span class="text-(--text-tertiary)">•</span>
					<span>{formatDate(video.publishedAt ?? video.createdAt)}</span>
					{#if video.category}
						<span class="ml-1 rounded-full bg-(--bg-active) px-2 py-0.5 text-[11px] font-medium">
							{video.category}
						</span>
					{/if}
				</div>

				{#if video.description}
					<FormattedDescription text={video.description} class="mt-2 {descriptionOpen ? '' : 'line-clamp-2'}" />
					<button
						class="mt-1.5 text-[13px] font-semibold text-(--text-secondary) hover:text-(--text)"
						onclick={() => (descriptionOpen = !descriptionOpen)}
					>
						{descriptionOpen ? 'Свернуть' : 'Ещё'}
					</button>
				{:else}
					<p class="mt-2 text-(--text-secondary)">Описание не добавлено.</p>
				{/if}

				{#if video.tags && video.tags.length > 0}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each video.tags as tag (tag)}
							<a
								href="/results?q={encodeURIComponent(tag)}"
								class="rounded-full bg-(--bg-active) px-2.5 py-1 text-[11.5px] font-semibold text-sky-400 transition hover:bg-(--border-strong)"
							>
								#{tag}
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<CommentSection
				videoId={video.id}
				videoOwnerId={video.userId}
				comments={data.comments}
				count={video.commentCount}
			/>
			</div>
		</div>

		{#snippet relatedList()}
			{#if data.recommendations.length > 0}
				<div class="flex flex-col gap-3">
					{#each bigVideos.slice(0, 3) as item (item.id)}
						<VideoRow video={item} />
					{/each}
				</div>
				<ShortsShelf shorts={shortVideos} />
				{#if bigVideos.length > 3}
					<div class="mt-5 flex flex-col gap-3">
						{#each bigVideos.slice(3) as item (item.id)}
							<VideoRow video={item} />
						{/each}
					</div>
				{/if}
			{:else}
				<p class="rounded-xl border border-(--border) bg-(--bg-subtle) p-4 text-sm text-(--text-secondary)">
					Других видео пока нет.
				</p>
			{/if}
		{/snippet}

		{#if !theater}
			<aside class="min-w-0">
				<h2 class="font-display mb-3 text-[15px] font-bold tracking-tight">Похожие видео</h2>
				{@render relatedList()}
			</aside>
		{/if}
	</div>

	{#if theater && data.recommendations.length > 0}
		<section class="mt-10 border-t border-(--border) pt-6">
			<h2 class="font-display mb-4 text-lg font-bold tracking-tight">Похожие видео</h2>
			<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
				{#each bigVideos.slice(0, 3) as item (item.id)}
					<VideoCard video={item} />
				{/each}
			</div>
			<ShortsShelf shorts={shortVideos} />
			{#if bigVideos.length > 3}
				<div class="mt-8 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
					{#each bigVideos.slice(3) as item (item.id)}
						<VideoCard video={item} />
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if user}
		<p class="mt-8 text-center text-xs text-(--text-tertiary)">
			Вы вошли как {user.name} • {timeAgo(video.publishedAt ?? video.createdAt)}
		</p>
	{/if}
</div>
{/if}

<ConfirmDialog
	bind:open={deleteOpen}
	title="Удалить видео?"
	description="Видео и его обложка будут удалены навсегда. Восстановить их не получится."
	confirmLabel="Удалить видео"
	onconfirm={deleteVideo}
/>
