<script lang="ts">
	import Icon from './Icon.svelte';
	import { formatDuration } from '#lib/utils/format';

	let {
		src,
		poster = null,
		vertical = false
	}: {
		src: string;
		poster?: string | null;
		vertical?: boolean;
	} = $props();

	let videoEl = $state<HTMLVideoElement>();
	let shell = $state<HTMLDivElement>();
	let playing = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(1);
	let muted = $state(false);
	let fullscreen = $state(false);
	let controlsVisible = $state(true);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	function wake() {
		controlsVisible = true;
		clearTimeout(hideTimer);
		if (playing) hideTimer = setTimeout(() => (controlsVisible = false), 2400);
	}

	function togglePlay() {
		if (!videoEl) return;
		if (videoEl.paused) void videoEl.play();
		else videoEl.pause();
		wake();
	}

	function seek(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (!videoEl) return;
		videoEl.currentTime = Number(input.value);
		currentTime = videoEl.currentTime;
		wake();
	}

	function changeVolume(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		volume = Number(input.value);
		muted = volume === 0;
		wake();
	}

	function toggleMute() {
		muted = !muted;
		wake();
	}

	function toggleFullscreen() {
		if (!shell) return;
		if (document.fullscreenElement) void document.exitFullscreen();
		else void shell.requestFullscreen();
	}

	function onKeydown(event: KeyboardEvent) {
		if (!videoEl) return;
		if (event.key === ' ' || event.key === 'k') {
			event.preventDefault();
			togglePlay();
		} else if (event.key === 'ArrowLeft') {
			videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
		} else if (event.key === 'ArrowRight') {
			videoEl.currentTime = Math.min(duration, videoEl.currentTime + 5);
		} else if (event.key === 'm') {
			toggleMute();
		} else if (event.key === 'f') {
			toggleFullscreen();
		}
		wake();
	}

	function onFullscreenChange() {
		fullscreen = Boolean(document.fullscreenElement);
		wake();
	}

	$effect(() => {
		if (videoEl) videoEl.volume = volume;
	});
	$effect(() => {
		if (videoEl) videoEl.muted = muted;
	});
</script>

<svelte:window onfullscreenchange={onFullscreenChange} />

<div
	bind:this={shell}
	class="group relative w-full overflow-hidden bg-black outline-none {vertical ? 'h-[440px] sm:h-[540px]' : 'aspect-video'}"
	tabindex="0"
	role="region"
	aria-label="Предпросмотр видео"
	onpointermove={wake}
	onpointerleave={() => playing && (controlsVisible = false)}
	onkeydown={onKeydown}
>
	<video
		bind:this={videoEl}
		{src}
		poster={poster ?? undefined}
		playsinline
		preload="metadata"
		class="h-full w-full object-contain"
		onclick={togglePlay}
		ontimeupdate={() => (currentTime = videoEl?.currentTime ?? 0)}
		onloadedmetadata={() => (duration = videoEl?.duration || 0)}
		ondurationchange={() => (duration = videoEl?.duration || 0)}
		onplay={() => {
			playing = true;
			wake();
		}}
		onpause={() => {
			playing = false;
			controlsVisible = true;
		}}
		onended={() => {
			playing = false;
			controlsVisible = true;
		}}
	></video>

	{#if !playing}
		<button
			type="button"
			class="absolute inset-0 grid place-items-center transition hover:bg-white/5"
			aria-label="Воспроизвести предпросмотр"
			onclick={togglePlay}
		>
			<span class="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-2xl backdrop-blur-md transition group-hover:scale-105">
				<Icon name="play" size={28} filled />
			</span>
		</button>
	{/if}

	<div
		class="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/85 via-black/35 to-transparent transition-opacity duration-300 {controlsVisible || !playing
			? 'opacity-100'
			: 'opacity-0'}"
	></div>

	<div
		class="absolute inset-x-3 bottom-3 transition-opacity duration-300 {controlsVisible || !playing
			? 'opacity-100'
			: 'pointer-events-none opacity-0'}"
	>
		<input
			type="range"
			min="0"
			max={duration || 0}
			step="0.1"
			value={currentTime}
			oninput={seek}
			class="player-range h-1.5 w-full cursor-pointer appearance-none rounded-full accent-white"
			aria-label="Позиция видео"
		/>
		<div class="mt-2 flex items-center gap-2 text-white">
			<button type="button" class="player-btn" aria-label={playing ? 'Пауза' : 'Играть'} onclick={togglePlay}>
				<Icon name={playing ? 'pause' : 'play'} size={18} filled={!playing} />
			</button>
			<span class="text-[11px] font-semibold tabular-nums text-white/90">
				{formatDuration(currentTime)} <span class="text-white/50">/ {formatDuration(duration)}</span>
			</span>
			<div class="ml-auto flex items-center gap-1.5">
				<button type="button" class="player-btn" aria-label={muted ? 'Включить звук' : 'Выключить звук'} onclick={toggleMute}>
					<Icon name={muted || volume === 0 ? 'volumeX' : 'volume'} size={17} />
				</button>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={muted ? 0 : volume}
					oninput={changeVolume}
					class="player-volume h-1 w-16 cursor-pointer appearance-none rounded-full accent-white"
					aria-label="Громкость"
				/>
				<button type="button" class="player-btn" aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'} onclick={toggleFullscreen}>
					<Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} size={17} />
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.player-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		width: 32px;
		border-radius: 10px;
		background: rgb(255 255 255 / 0.12);
		transition: background-color 0.18s ease, transform 0.18s ease;
	}

	.player-btn:hover {
		background: rgb(255 255 255 / 0.24);
		transform: scale(1.06);
	}

	.player-range::-webkit-slider-thumb,
	.player-volume::-webkit-slider-thumb {
		width: 13px;
		height: 13px;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.6);
		appearance: none;
	}

	.player-range::-moz-range-thumb,
	.player-volume::-moz-range-thumb {
		width: 13px;
		height: 13px;
		border: 0;
		border-radius: 999px;
		background: #fff;
	}
</style>
