<script lang="ts">
	import type { VideoCardData } from '#lib/types';
	import { colorFor, formatDuration, formatViews, timeAgo } from '#lib/utils/format';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import VideoMenu from './VideoMenu.svelte';
	import VerifiedBadge from './VerifiedBadge.svelte';

	let {
		video,
		showChannel = true
	}: {
		video: VideoCardData;
		showChannel?: boolean;
	} = $props();

	let preview = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let previewEl = $state<HTMLVideoElement>();

	const href = $derived(video.isShort ? `/shorts?v=${video.id}` : `/watch/${video.id}`);
	const progressPercent = $derived(
		video.progress && video.duration ? Math.min(100, (video.progress / video.duration) * 100) : 0
	);

	function startPreview() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			preview = true;
		}, 550);
	}

	function stopPreview() {
		clearTimeout(timer);
		preview = false;
	}

	$effect(() => {
		if (preview && previewEl) {
			previewEl.currentTime = 0;
			previewEl.play().catch(() => {});
		}
	});
</script>

<article class="hover-card group flex min-w-0 flex-col gap-2.5">
	<div class="relative">
		<a
			href={href}
			class="relative block aspect-video overflow-hidden rounded-xl bg-(--bg-subtle)"
			onmouseenter={startPreview}
			onmouseleave={stopPreview}
			aria-label={video.title}
		>
			{#if video.thumbnail}
				<img
					src={video.thumbnail}
					alt={video.title}
					loading="lazy"
					class="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
				/>
			{:else}
				<div
					class="flex h-full w-full items-center justify-center"
					style="background:{colorFor(video.id)}"
				>
					<span class="flex h-12 w-12 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm">
						<Icon name="play" size={22} filled />
					</span>
				</div>
			{/if}

			{#if preview}
				<video
					bind:this={previewEl}
					src={video.videoUrl}
					muted
					loop
					playsinline
					preload="none"
					class="absolute inset-0 h-full w-full object-cover"
				></video>
			{/if}

			<span
				class="absolute right-1.5 bottom-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur-sm"
			>
				{formatDuration(video.duration)}
			</span>

			{#if progressPercent > 0}
				<div class="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
					<div class="h-full bg-(--accent)" style="width:{progressPercent}%"></div>
				</div>
			{/if}
		</a>
		<VideoMenu videoId={video.id} ownerId={video.user.id} />
	</div>

	<div class="flex min-w-0 gap-3">
		{#if showChannel}
			<a href="/channel/{video.user.id}" class="mt-0.5 shrink-0" aria-label={video.user.name}>
				<Avatar name={video.user.name} image={video.user.image} id={video.user.id} size={36} />
			</a>
		{/if}

		<div class="min-w-0 flex-1">
			<a href={href} class="block">
				<h3 class="line-clamp-2 text-[15px] leading-[1.35] font-semibold tracking-[-0.01em] transition-colors group-hover:text-(--accent)">
					{video.title}
				</h3>
			</a>
			<a
				href="/channel/{video.user.id}"
				class="mt-1 inline-flex max-w-full items-center gap-1 text-[13px] text-(--text-secondary) transition-colors hover:text-(--text)"
			>
				<span class="truncate">{video.user.name}</span>
				{#if video.user.verified}
					<VerifiedBadge size={13} />
				{/if}
			</a>
			<p class="mt-0.5 text-[13px] text-(--text-secondary)">
				{formatViews(video.viewCount)} • {timeAgo(video.createdAt)}
			</p>
		</div>
	</div>
</article>
