<script lang="ts">
	import { page } from '$app/state';
	import { formatDate, formatSubscribers, formatVideos } from '#lib/utils/format';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import VerifiedBadge from '#lib/components/VerifiedBadge.svelte';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import SubscribeButton from '#lib/components/SubscribeButton.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ShortsShelf from '#lib/components/ShortsShelf.svelte';
	import LiveCard from '#lib/components/LiveCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let subscriberCount = $state(data.channel.subscriberCount);

	const user = $derived(page.data.user);
	const channel = $derived(data.channel);
	const shorts = $derived(data.videos.filter((v) => v.isShort));
	const regularVideos = $derived(data.videos.filter((v) => !v.isShort));
	const handle = $derived(channel.username ? `@${channel.username}` : `@${channel.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-zа-яё0-9._-]/gi, '')}`);

	$effect(() => {
		subscriberCount = data.channel.subscriberCount;
	});
</script>

<svelte:head>
	<title>{channel.name} — VueTube</title>
</svelte:head>

<div class="mx-auto max-w-[1800px] px-4 py-4 pb-14 sm:px-6 sm:py-5">
	<div class="relative h-36 overflow-hidden rounded-[20px] bg-(--bg-subtle) sm:h-44 2xl:h-56 2xl:rounded-[28px]">
		{#if channel.banner}
			<img src={channel.banner} alt="" class="h-full w-full object-cover" />
		{/if}
	</div>

	<div class="px-1 sm:px-2">
		<div class="flex flex-wrap items-center justify-between gap-4 pt-5">
			<div class="flex min-w-0 items-center gap-4">
				<div class="shrink-0">
					<Avatar name={channel.name} image={channel.image} id={channel.id} size={80} />
				</div>
				<div class="min-w-0">
					<h1 class="font-display flex items-center gap-2 text-2xl font-extrabold tracking-[-0.03em] sm:text-[28px]">
						<span class="truncate">{channel.name}</span>
						{#if channel.verified}
							<VerifiedBadge size={20} label="Верифицированный канал" />
						{/if}
						{#if channel.creator}
							<span class="inline-flex items-center gap-1 rounded-[8px] bg-(--bg-subtle) px-2 py-1 text-[10px] font-bold">Создатель</span>
						{/if}
					</h1>
					{#if data.isOwner && page.data.ban?.banned}
						<p class="mt-2 inline-flex items-center gap-1.5 rounded-[8px] bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-bold">
							<Icon name="lock" size={12} />
							Аккаунт заморожен · выкладка недоступна
						</p>
					{/if}
					<p class="mt-1 truncate text-[13px] text-(--text-secondary)">
						{handle} • {formatSubscribers(subscriberCount)} • {formatVideos(channel.videoCount)}
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 pb-1">
				{#if data.isOwner}
					<a href="/upload" class="btn-primary h-9 px-4 text-[13px]">
						<Icon name="upload" size={16} />
						Загрузить видео
					</a>
					<a href="/settings" class="btn-secondary h-9 px-4 text-[13px]">
						<Icon name="settings" size={16} />
						Настроить канал
					</a>
				{:else if user}
					<SubscribeButton
						channelId={channel.id}
						subscribed={data.subscribed}
						count={subscriberCount}
						showCount={false}
						onchange={(_subscribed, count) => (subscriberCount = count)}
					/>
				{:else}
					<a href="/login?redirect={encodeURIComponent(page.url.pathname)}" class="btn-primary h-9 px-4 text-[13px]">
						<Icon name="plus" size={16} />
						Подписаться
					</a>
				{/if}
			</div>
		</div>

		{#if channel.bio}
			<p class="mt-4 max-w-3xl text-sm leading-relaxed text-(--text-secondary)">{channel.bio}</p>
		{/if}

		{#if data.liveStreams.length > 0}
			<section class="mt-6">
				<div class="mb-3 flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-(--text)"></span>
					<h2 class="font-display text-[16px] font-extrabold">В эфире</h2>
				</div>
				<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.liveStreams as stream (stream.id)}
						<LiveCard {stream} />
					{/each}
				</div>
			</section>
		{/if}

		<div class="mt-6 flex w-fit items-center gap-1 rounded-[14px] bg-(--bg-subtle) p-1">
			<a
				href="/channel/{channel.id}"
				class="rounded-[10px] px-4 py-2 text-[13px] font-semibold transition duration-200 {data.tab === 'videos' ? 'bg-(--bg-elevated) text-(--text)' : 'text-(--text-secondary) hover:text-(--text)'}"
			>
				Видео
			</a>
			<a
				href="/channel/{channel.id}?tab=about"
				class="rounded-[10px] px-4 py-2 text-[13px] font-semibold transition duration-200 {data.tab === 'about' ? 'bg-(--bg-elevated) text-(--text)' : 'text-(--text-secondary) hover:text-(--text)'}"
			>
				О канале
			</a>
		</div>

		{#if data.tab === 'videos'}
			{#if regularVideos.length > 0}
				<div class="mt-6 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
					{#each regularVideos as video (video.id)}
						<VideoCard {video} showChannel={false} />
					{/each}
				</div>
			{:else if shorts.length === 0 && data.isOwner}
				<EmptyState
					icon="upload"
					title="На канале пока нет видео"
					description="Загрузите первое видео — оно появится здесь и в общей ленте."
				>
					<a href="/upload" class="btn-primary">
						<Icon name="upload" size={17} />
						Загрузить видео
					</a>
				</EmptyState>
			{:else if shorts.length === 0}
				<EmptyState
					icon="film"
					title="На канале пока нет видео"
					description="Автор ещё не опубликовал ни одного видео. Подпишитесь, чтобы не пропустить премьеру."
				/>
			{/if}

			<ShortsShelf shorts={shorts} />
		{:else}
			<div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div class="rounded-2xl border border-(--border) bg-(--bg-subtle) p-5">
					<h2 class="font-display text-lg font-bold tracking-tight">Описание</h2>
					<p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-(--text-secondary)">
						{channel.bio || 'Автор пока не рассказал о своём канале.'}
					</p>
					<div class="hairline my-4"></div>
					<p class="flex items-center gap-2 text-xs text-(--text-tertiary)">
						<Icon name="calendar" size={14} />
						На VueTube с {formatDate(channel.createdAt)}
					</p>
				</div>

				<div class="rounded-2xl border border-(--border) bg-(--bg-subtle) p-5">
					<h2 class="font-display text-lg font-bold tracking-tight">Статистика</h2>
					<dl class="mt-3 space-y-3 text-sm">
						<div class="flex items-center justify-between">
							<dt class="text-(--text-secondary)">Подписчики</dt>
							<dd class="font-semibold">{formatSubscribers(subscriberCount)}</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-(--text-secondary)">Видео</dt>
							<dd class="font-semibold">{formatVideos(channel.videoCount)}</dd>
						</div>
					</dl>
				</div>
			</div>
		{/if}
	</div>
</div>
