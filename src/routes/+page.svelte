<script lang="ts">
	import { page, navigating } from '$app/state';
	import { CATEGORIES } from '#lib/constants';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import VideoCardSkeleton from '#lib/components/VideoCardSkeleton.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ShortsShelf from '#lib/components/ShortsShelf.svelte';
	import LiveCard from '#lib/components/LiveCard.svelte';
	import { formatDuration, formatViews } from '#lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const user = $derived(page.data.user);
	const feedLoading = $derived(navigating.to !== null);
</script>

<svelte:head>
	<title>VueTube — главная</title>
</svelte:head>

{#if data.videos.length === 0 && data.shorts.length === 0 && data.category === 'Все'}
	<section class="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-5 py-16">
		<div class="animate-in flex max-w-lg flex-col items-center text-center">
			<div class="mb-8 flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-(--text) text-(--bg)">
				<Icon name="play" size={28} filled />
			</div>

			<h1 class="font-display text-[36px] leading-[1.04] font-extrabold tracking-[-0.045em] sm:text-[52px]">
				Твоё видео.<br />
				<span class="text-(--accent)">Твоя аудитория.</span>
			</h1>

			<p class="mt-5 max-w-sm text-[15px] leading-relaxed text-(--text-secondary)">
				Загрузите первое видео — оно появится в ленте, на канале и в поиске.
			</p>

			<div class="mt-9 flex flex-col items-center gap-3.5">
				{#if user}
					<a href="/upload" class="btn-primary h-11 px-7 text-[14px]">
						<Icon name="upload" size={18} />
						Загрузить видео
					</a>
				{:else}
					<a href="/register" class="btn-primary h-11 px-7 text-[14px]">
						Начать
						<Icon name="chevronRight" size={17} strokeWidth={2.2} />
					</a>
					<a href="/login" class="text-[13px] font-medium text-(--text-secondary) transition hover:text-(--text)">
						У меня уже есть аккаунт
					</a>
				{/if}
			</div>
		</div>
	</section>
{:else}
	<div class="mx-auto max-w-[1800px] px-4 pt-4 pb-14 sm:px-6">
		<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
			{#each CATEGORIES as category (category)}
				<a
					href={category === 'Все' ? '/' : `/?category=${encodeURIComponent(category)}`}
					class="chip {data.category === category ? 'chip-active' : ''}"
				>
					{category}
				</a>
			{/each}
		</div>

		{#if data.liveStreams.length > 0}
			<section class="mt-6">
				<div class="mb-3 flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-(--text)"></span>
					<h2 class="font-display text-[18px] font-extrabold tracking-[-0.02em]">В эфире</h2>
				</div>
				<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
					{#each data.liveStreams as stream (stream.id)}
						<LiveCard {stream} />
					{/each}
				</div>
			</section>
		{/if}

		<div class="mt-6 mb-5">
			<h1 class="font-display text-[22px] font-extrabold tracking-[-0.02em]">
				{data.category === 'Все' ? 'Рекомендации' : data.category}
			</h1>
			<p class="mt-1 text-[12px] text-(--text-tertiary)">
				Подбираем по оформлению канала, свежести и вашим интересам
			</p>
		</div>

		{#if feedLoading}
			<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
				{#each Array(8) as _, index (index)}
					<VideoCardSkeleton />
				{/each}
			</div>
		{:else if data.videos.length > 0}
			<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
				{#each data.videos as video (video.id)}
					<VideoCard {video} />
				{/each}
			</div>
		{:else}
			<EmptyState
				icon="search"
				title="В этой категории пока пусто"
				description="Выберите другую категорию — или посмотрите всё, что уже есть."
			>
				<a href="/" class="btn-secondary">
					<Icon name="arrowLeft" size={17} />
					Все видео
				</a>
			</EmptyState>
		{/if}

		<ShortsShelf shorts={data.shorts} />
	</div>
{/if}
