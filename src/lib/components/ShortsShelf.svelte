<script lang="ts">
	import Icon from './Icon.svelte';
	import ShortsLogo from './ShortsLogo.svelte';
	import { formatCompact, formatDuration } from '#lib/utils/format';

	let {
		shorts
	}: {
		shorts: {
			id: string;
			title: string;
			thumbnail: string | null;
			duration: number;
			viewCount?: number;
			hasMusic?: boolean;
			user?: { id: string; name: string; image: string | null } | null;
		}[];
	} = $props();
</script>

{#if shorts.length > 0}
	<section class="mt-10">
		<div class="mb-3 flex items-center gap-2">
			<ShortsLogo size={14} />
			<h2 class="font-display text-[18px] font-extrabold tracking-[-0.02em]">Shorts</h2>
			<a href="/shorts" class="ml-auto text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)">Все →</a>
		</div>
		<div class="no-scrollbar flex gap-3 overflow-x-auto pb-2">
			{#each shorts as short (short.id)}
				<div class="group w-[180px] shrink-0">
					<a href="/shorts?v={short.id}" class="relative block aspect-[9/16] overflow-hidden rounded-[14px] bg-(--bg-subtle)">
						{#if short.thumbnail}
							<img src={short.thumbnail} alt={short.title} class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
						{:else}
							<div class="flex h-full w-full items-center justify-center bg-(--bg-active)"><Icon name="play" size={24} filled /></div>
						{/if}
						<span class="absolute bottom-2 left-2 rounded-[7px] bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{formatDuration(short.duration)}</span>
					</a>
					<p class="mt-2 line-clamp-2 text-[12px] font-semibold leading-snug">
						{#if short.hasMusic}<Icon name="music" size={12} class="!inline-block mr-1 align-[-2px] text-(--text-tertiary)" />{/if}{short.title}
					</p>
					<span class="mt-1 block text-[11px] text-(--text-tertiary)">
						{formatCompact(short.viewCount ?? 0)} просмотров
					</span>
				</div>
			{/each}
		</div>
	</section>
{/if}
