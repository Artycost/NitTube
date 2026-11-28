<script lang="ts">
	import { navigating } from '$app/state';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import VideoCardSkeleton from '#lib/components/VideoCardSkeleton.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const feedLoading = $derived(navigating.to !== null);
</script>

<svelte:head>
	<title>Подписки — VueTube</title>
</svelte:head>

<div class="mx-auto max-w-[1800px] px-4 pt-4 pb-14 sm:px-6 fade-in">
	<h1 class="font-display mb-6 text-[22px] font-extrabold tracking-[-0.02em]">Подписки</h1>

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
		<EmptyState icon="subscriptions" title="Нет новых видео" description="Подпишитесь на интересные каналы, чтобы видеть их видео здесь." />
	{/if}
</div>
