<script lang="ts">
	import VideoCard from '#lib/components/VideoCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ShortsShelf from '#lib/components/ShortsShelf.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const shorts = $derived(data.videos.filter((v) => v.isShort));
	const regular = $derived(data.videos.filter((v) => !v.isShort));
</script>

<svelte:head>
	<title>Мои видео — VueTube</title>
</svelte:head>

<div class="mx-auto max-w-[1800px] px-4 pt-4 pb-14 sm:px-6 fade-in">
	<h1 class="font-display mb-6 text-[22px] font-extrabold tracking-[-0.02em]">Мои видео</h1>

	{#if regular.length > 0}
		<div class="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
			{#each regular as video (video.id)}
				<VideoCard {video} />
			{/each}
		</div>
	{:else if shorts.length === 0}
		<EmptyState icon="film" title="У вас еще нет видео" description="Загрузите своё первое видео, и оно появится здесь." />
	{/if}

	<ShortsShelf shorts={shorts} />
</div>
