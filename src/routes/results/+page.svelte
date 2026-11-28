<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import FormattedDescription from '#lib/components/FormattedDescription.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ShortsShelf from '#lib/components/ShortsShelf.svelte';
	import VerifiedBadge from '#lib/components/VerifiedBadge.svelte';
	import VideoMenu from '#lib/components/VideoMenu.svelte';
	import { formatDuration, formatViews, timeAgo } from '#lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Tab = 'Все' | 'Видео' | 'Shorts';
	const tabs: Tab[] = ['Все', 'Видео', 'Shorts'];
	let tab = $state<Tab>('Все');
	let sort = $state<'По дате' | 'По просмотрам'>('По дате');
	let pageNumber = $state(1);
	const pageSize = 6;

	const shorts = $derived(data.videos.filter((video) => video.isShort));
	const regular = $derived(data.videos.filter((video) => !video.isShort));
	const sorted = $derived(
		sort === 'По просмотрам' ? [...regular].sort((a, b) => b.viewCount - a.viewCount) : regular
	);
	const totalPages = $derived(Math.max(2, Math.ceil(sorted.length / pageSize)));
	const pageVideos = $derived(sorted.slice((pageNumber - 1) * pageSize, pageNumber * pageSize));

	function selectTab(value: Tab) {
		tab = value;
		pageNumber = 1;
	}

	function toggleSort() {
		sort = sort === 'По дате' ? 'По просмотрам' : 'По дате';
		pageNumber = 1;
	}
</script>

<svelte:head>
	<title>{data.q ? `Поиск: ${data.q}` : 'Поиск'} — VueTube</title>
	<meta name="description" content={data.q ? `Результаты поиска по запросу «${data.q}» на VueTube` : 'Поиск видео на VueTube'} />
</svelte:head>

<div class="mx-auto max-w-[1800px] px-4 pt-6 pb-16 sm:px-6 fade-in">
	<div class="mb-5 flex flex-wrap items-center gap-2 border-b border-(--border) pb-3">
		<span class="inline-flex items-center gap-2 rounded-[10px] bg-(--bg-elevated) px-3 py-2 text-[12px] font-semibold">
			<Icon name="filter" size={16} />
			Фильтры
		</span>
		<div class="no-scrollbar flex gap-2 overflow-x-auto">
			{#each tabs as item (item)}
				<button
					class="shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold transition {tab === item
						? 'bg-(--text) text-(--bg)'
						: 'bg-(--bg-elevated) text-(--text-secondary) hover:text-(--text)'}"
					onclick={() => selectTab(item)}
				>
					{item}
				</button>
			{/each}
		</div>
		<button
			class="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-(--bg-elevated) px-3 py-2 text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)"
			onclick={toggleSort}
		>
			<Icon name="sort" size={15} />
			{sort}
		</button>
	</div>

	<div class="mb-4">
		<p class="mb-1 text-[12px] font-semibold tracking-wide text-(--text-tertiary) uppercase">Поиск</p>
		<h1 class="font-display text-[22px] font-extrabold tracking-[-0.03em] sm:text-[26px]">
			{data.q ? `Результаты по запросу «${data.q}»` : 'Найдите видео'}
		</h1>
		{#if data.q}
			<p class="mt-1 text-[12px] text-(--text-tertiary)">{data.videos.length} результатов</p>
		{/if}
	</div>

	{#if tab !== 'Видео' && shorts.length > 0}
		<ShortsShelf {shorts} />
	{/if}

	{#if tab !== 'Shorts' && pageVideos.length > 0}
		<div class="mt-6 flex flex-col gap-6">
			{#each pageVideos as video (video.id)}
				<div class="group flex gap-3 sm:gap-4">
					<a href="/watch/{video.id}" class="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-[10px] bg-(--bg-subtle) max-sm:w-[140px]">
						{#if video.thumbnail}
							<img src={video.thumbnail} alt={video.title} loading="lazy" class="h-full w-full object-cover" />
						{:else}
							<div class="flex h-full w-full items-center justify-center bg-(--bg-active)"><Icon name="play" size={20} filled /></div>
						{/if}
						<span class="absolute right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white tabular-nums">
							{formatDuration(video.duration)}
						</span>
					</a>

					<div class="min-w-0 flex-1">
						<div class="flex items-start gap-2">
							<a href="/watch/{video.id}" class="line-clamp-2 text-[14px] leading-snug font-bold transition group-hover:text-(--accent) sm:text-[15px]">
								{video.title}
							</a>
							<div class="ml-auto shrink-0"><VideoMenu videoId={video.id} /></div>
						</div>
						<a href="/channel/{video.user.id}" class="mt-1.5 flex items-center gap-1.5 text-[12px] text-(--text-secondary) transition hover:text-(--text)">
							<Avatar name={video.user.name} image={video.user.image} id={video.user.id} size={18} />
							<span class="truncate">{video.user.name}</span>
							{#if video.user.verified}<VerifiedBadge size={11} />{/if}
						</a>
						<p class="mt-0.5 text-[12px] text-(--text-secondary)">{formatViews(video.viewCount)} • {timeAgo(video.createdAt)}</p>
						{#if video.description}
							<FormattedDescription text={video.description} class="mt-1 line-clamp-2 text-[12px] text-(--text-tertiary)" />
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-10 flex items-center justify-center gap-2">
			{#each Array(totalPages) as _, i (i)}
				<button
					class="h-9 min-w-9 rounded-[10px] px-3 text-[12px] font-bold transition {pageNumber === i + 1
						? 'bg-(--text) text-(--bg)'
						: 'bg-(--bg-elevated) text-(--text-secondary) hover:text-(--text)'}"
					onclick={() => (pageNumber = i + 1)}
				>
					{i + 1}
				</button>
			{/each}
		</div>
	{:else if data.videos.length === 0}
		<div class="mt-10">
			<EmptyState
				icon="search"
				title={data.q ? 'Ничего не найдено' : 'Что будем искать?'}
				description={data.q
					? 'Попробуйте изменить запрос или проверьте написание.'
					: 'Введите запрос в строке поиска сверху.'}
			/>
		</div>
	{/if}
</div>
