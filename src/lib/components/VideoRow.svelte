<script lang="ts">
	import type { VideoCardData } from '#lib/types';
	import { colorFor, formatDuration, formatViews, timeAgo } from '#lib/utils/format';
	import Icon from './Icon.svelte';
	import VerifiedBadge from './VerifiedBadge.svelte';

	let { video }: { video: VideoCardData } = $props();
	const href = $derived(video.isShort ? `/shorts?v=${video.id}` : `/watch/${video.id}`);
</script>

<a href={href} class="group flex gap-3">
	<div class="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-lg bg-(--bg-subtle) max-sm:w-[140px]">
		{#if video.thumbnail}
			<img src={video.thumbnail} alt={video.title} loading="lazy" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center" style="background:{colorFor(video.id)}">
				<Icon name="play" size={16} filled class="text-white/90" />
			</div>
		{/if}
		<span class="absolute right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white tabular-nums">
			{formatDuration(video.duration)}
		</span>
		{#if video.progress && video.duration}
			<div class="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
				<div class="h-full bg-(--accent)" style="width:{Math.min(100, (video.progress / video.duration) * 100)}%"></div>
			</div>
		{/if}
	</div>

	<div class="min-w-0 flex-1 py-0.5">
		<h3 class="line-clamp-2 text-[13.5px] leading-[1.35] font-semibold transition-colors group-hover:text-(--accent)">
			{video.title}
		</h3>
		<p class="mt-1 flex items-center gap-1 truncate text-xs text-(--text-secondary)">
			{video.user.name}
			{#if video.user.verified}
				<VerifiedBadge size={11} />
			{/if}
		</p>
		<p class="text-xs text-(--text-secondary)">{formatViews(video.viewCount)} • {timeAgo(video.createdAt)}</p>
	</div>
</a>
