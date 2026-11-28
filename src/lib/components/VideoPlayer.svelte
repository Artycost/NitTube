<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { clickOutside } from '#lib/actions/clickOutside';
	import { clamp, formatDuration } from '#lib/utils/format';
	import Icon from './Icon.svelte';

	let {
		src,
		poster,
		videoId,
		initialProgress = 0,
		quality = '',
		live = false,
		canEdit = false,
		edgeToEdge = false,
		ontheater
	}: {
		src: string;
		poster?: string | null;
		videoId: string;
		initialProgress?: number;
		quality?: string | null;
		live?: boolean;
		canEdit?: boolean;
		edgeToEdge?: boolean;
		ontheater?: () => void;
	} = $props();

	type QualityOption = {
		quality: string;
		url: string;
		width: number;
		height: number;
		qualityHeight: number;
		source: boolean;
	};

	let container = $state<HTMLDivElement>();
	let videoEl = $state<HTMLVideoElement>();
	let seekBar = $state<HTMLDivElement>();
	let availableQualities = $state<QualityOption[]>([]);

	let playing = $state(false);
	let waiting = $state(true);
	let ended = $state(false);
	let error = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let buffered = $state(0);
	let volume = $state(1);
	let muted = $state(false);
	let autoMuted = $state(false);
	let rate = $state(1);
	let fullscreen = $state(false);
	let controlsVisible = $state(true);
	let settingsOpen = $state(false);
	let settingsView = $state<'main' | 'speed' | 'quality' | 'subtitles'>('main');
	let qualityChoice = $state(quality || 'Авто');
	let selectedQualityUrl = $state(src);
	let normalize = $state(false);
	let voiceBoost = $state(false);
	let announcer = $state(false);
	let autoOff = $state(false);
	let subtitles = $state(false);
	let hoverTime = $state<number | null>(null);
	let hoverX = $state(0);
	let previewUrl = $state('');
	let previewMedia: HTMLVideoElement | null = null;
	let previewTimer: ReturnType<typeof setTimeout> | undefined;
	let seeking = $state(false);
	let started = $state(false);

	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let lastSaved = 0;
	let resumed = false;

	// Real audio processing chain (Web Audio API)
	let audioCtx: AudioContext | null = null;
	let audioSource: MediaElementAudioSourceNode | null = null;
	let compressor: DynamicsCompressorNode | null = null;
	let voiceFilter: BiquadFilterNode | null = null;
	let outputGain: GainNode | null = null;
	let audioReady = $state(false);

	// Announcements, captions and sleep timer
	let sleepLeft = $state(0);
	let sleepTimer: ReturnType<typeof setInterval> | undefined;
	let subtitlesFound = $state(false);
	let subtitleCues = $state<{ start: number; end: number; text: string }[]>([]);
	let subtitleDraft = $state('');
	let savingSubtitles = $state(false);
	let subtitlePos = $state({ x: 50, y: 82 });
	let subtitleDrag = { active: false, startX: 0, startY: 0, x: 50, y: 82 };

	function onSubtitlePointerDown(event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		subtitleDrag = {
			active: true,
			startX: event.clientX,
			startY: event.clientY,
			x: subtitlePos.x,
			y: subtitlePos.y
		};
	}

	function onSubtitlePointerMove(event: PointerEvent) {
		if (!subtitleDrag.active || !container) return;
		const rect = container.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const x = subtitleDrag.x + ((event.clientX - subtitleDrag.startX) / rect.width) * 100;
		const y = subtitleDrag.y + ((event.clientY - subtitleDrag.startY) / rect.height) * 100;
		subtitlePos = { x: clamp(x, 8, 92), y: clamp(y, 8, 92) };
	}

	function onSubtitlePointerUp(event: PointerEvent) {
		if (!subtitleDrag.active) return;
		subtitleDrag.active = false;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {
			// pointer capture may already be gone
		}
		localStorage.setItem('vuetube:subtitle-pos', JSON.stringify(subtitlePos));
	}

	$effect(() => {
		const stored = localStorage.getItem('vuetube:subtitle-pos');
		if (!stored) return;
		try {
			const value = JSON.parse(stored) as { x: number; y: number };
			if (Number.isFinite(value.x) && Number.isFinite(value.y)) {
				subtitlePos = { x: clamp(value.x, 8, 92), y: clamp(value.y, 8, 92) };
			}
		} catch {
			// ignore malformed saved position
		}
	});

	function ensureAudio() {
		if (audioCtx || !videoEl || typeof AudioContext === 'undefined') return;
		try {
			audioCtx = new AudioContext();
			audioSource = audioCtx.createMediaElementSource(videoEl);
			compressor = audioCtx.createDynamicsCompressor();
			compressor.threshold.value = -18;
			compressor.knee.value = 12;
			compressor.ratio.value = 3;
			compressor.attack.value = 0.003;
			compressor.release.value = 0.25;
			voiceFilter = audioCtx.createBiquadFilter();
			voiceFilter.type = 'peaking';
			voiceFilter.frequency.value = 2200;
			voiceFilter.Q.value = 1.1;
			voiceFilter.gain.value = 7;
			outputGain = audioCtx.createGain();
			outputGain.gain.value = muted ? 0 : volume;
			audioReady = true;
			applyAudioChain();
		} catch {
			audioCtx = null;
		}
	}

	function applyAudioChain() {
		if (!audioCtx || !audioSource || !outputGain) return;
		audioSource.disconnect();
		compressor?.disconnect();
		voiceFilter?.disconnect();
		outputGain.disconnect();
		let tail: AudioNode = audioSource;
		if (normalize && compressor) {
			tail.connect(compressor);
			tail = compressor;
		}
		if (voiceBoost && voiceFilter) {
			tail.connect(voiceFilter);
			tail = voiceFilter;
		}
		tail.connect(outputGain);
		outputGain.connect(audioCtx.destination);
		outputGain.gain.value = muted ? 0 : volume;
		void audioCtx.resume();
	}

	function toggleAudio(setting: 'normalize' | 'voiceBoost') {
		if (setting === 'normalize') normalize = !normalize;
		else voiceBoost = !voiceBoost;
		ensureAudio();
		announce(setting === 'normalize' ? 'Выравнивание громкости' : 'Усиление голоса');
	}

	function announce(text: string) {
		if (!announcer || typeof SpeechSynthesisUtterance === 'undefined') return;
		try {
			speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = 'ru-RU';
			utterance.rate = 1;
			utterance.volume = 0.75;
			speechSynthesis.speak(utterance);
		} catch {
			// speech synthesis is optional
		}
	}

	function toggleAnnouncer() {
		announcer = !announcer;
		if (!announcer && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
		if (announcer) announce('Анонсаторы включены');
	}

	function parseVtt(text: string) {
		const cues: { start: number; end: number; text: string }[] = [];
		const toSeconds = (value: string) => {
			const [h, m, rest] = value.split(':');
			const [s, ms] = rest.split(',');
			return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
		};
		for (const block of text.replace(/\r/g, '').split(/\n{2,}/)) {
			const lines = block.split('\n');
			const index = lines.findIndex((line) => line.includes('-->'));
			if (index < 0) continue;
			const [from, to] = lines[index].split('-->').map((part) => part.trim());
			const cueText = lines.slice(index + 1).join(' ').trim();
			if (cueText) cues.push({ start: toSeconds(from), end: toSeconds(to), text: cueText });
		}
		return cues;
	}

	async function saveSubtitles() {
		savingSubtitles = true;
		try {
			const res = await fetch(`/api/videos/${videoId}/subtitles`, {
				method: 'PUT',
				headers: { 'content-type': 'text/plain' },
				body: subtitleDraft
			});
			if (res.ok) {
				subtitleCues = parseVtt(subtitleDraft);
				announce('Субтитры сохранены');
			}
		} finally {
			savingSubtitles = false;
		}
	}

	function toggleAutoOff() {
		autoOff = !autoOff;
		clearInterval(sleepTimer);
		if (!autoOff) {
			sleepLeft = 0;
			return;
		}
		sleepLeft = 5 * 60;
		sleepTimer = setInterval(() => {
			sleepLeft = Math.max(0, sleepLeft - 1);
			if (sleepLeft === 0) {
				clearInterval(sleepTimer);
				videoEl?.pause();
				autoOff = false;
				announce('Автовыключение: воспроизведение остановлено');
			}
		}, 1000);
		announce('Автовыключение включено');
	}

	onMount(() => {
		if (!live) return;
		let destroyed = false;
		let hls: { destroy: () => void } | undefined;

		(async () => {
			try {
				for (let i = 0; i < 20 && !videoEl; i++) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
				for (let attempt = 0; attempt < 12; attempt++) {
					const res = await fetch(src, { method: 'GET' });
					if (res.ok) break;
					if (destroyed) return;
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
				const Hls = (await import('hls.js')).default;
				if (destroyed || !videoEl) return;
				if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
					videoEl.src = src;
					videoEl.play().catch(() => {});
				} else if (Hls.isSupported()) {
					const instance = new Hls({ enableWorker: false, maxBufferLength: 4, backBufferLength: 4, maxMaxBufferLength: 8 });
					hls = instance;
					instance.loadSource(src);
					instance.attachMedia(videoEl);
					instance.on(Hls.Events.MANIFEST_PARSED, () => {
						if (videoEl) videoEl.muted = true;
						autoMuted = true;
						videoEl?.play().catch(() => {});
					});
				} else {
					error = true;
				}
				waiting = false;
			} catch {
				error = true;
			}
		})();

		return () => {
			destroyed = true;
			hls?.destroy();
		};
	});

	const playedPercent = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);

	$effect(() => {
		const stored = localStorage.getItem('vuetube:volume');
		if (stored !== null) {
			const value = Number(stored);
			if (Number.isFinite(value)) volume = clamp(value, 0, 1);
		}
	});

	$effect(() => {
		src;
		quality;
		selectedQualityUrl = src;
		qualityChoice = quality || 'Авто';
		resumed = false;
		started = false;
		ended = false;
		error = false;
		waiting = true;
		currentTime = 0;
		duration = 0;
		buffered = 0;
	});

	$effect(() => {
		if (!videoEl) return;
		videoEl.playbackRate = rate;
		if (audioReady && outputGain) {
			// Volume is controlled by the Web Audio gain node once the chain is active.
			videoEl.volume = 1;
			videoEl.muted = false;
			outputGain.gain.value = muted ? 0 : volume;
		} else {
			videoEl.volume = volume;
			videoEl.muted = muted;
		}
	});

	$effect(() => {
		normalize;
		voiceBoost;
		if (audioReady) applyAudioChain();
	});

	$effect(() => {
		if (!announcer && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
	});

	$effect(() => {
		if (live) return;
		let cancelled = false;
		let attempts = 0;
		const check = () => {
			fetch(`/api/videos/${videoId}/subtitles`)
				.then(async (res) => {
					if (cancelled) return;
					const found = res.headers.get('x-vuetube-subtitles') === 'found';
					subtitlesFound = found;
					if (!found) {
						if (attempts++ < 12) setTimeout(check, 5000);
						return;
					}
					const text = await res.text();
					if (cancelled) return;
					subtitleCues = parseVtt(text);
					subtitleDraft = text;
					if (localStorage.getItem(`vuetube:subtitles:${videoId}`) !== 'off') subtitles = true;
				})
				.catch(() => {});
		};
		check();
		return () => {
			cancelled = true;
		};
	});

	// A separate, hidden video renders hover frames so the main player never changes.
	$effect(() => {
		if (live || typeof document === 'undefined') return;
		const media = document.createElement('video');
		media.preload = 'auto';
		media.muted = true;
		media.playsInline = true;
		media.src = selectedQualityUrl || src;
		previewMedia = media;
		const canvas = document.createElement('canvas');
		canvas.width = 160;
		canvas.height = 90;
		let cancelled = false;
		const draw = () => {
			if (cancelled) return;
			const ctx = canvas.getContext('2d');
			if (!ctx || !media.videoWidth || !media.videoHeight) return;
			const ratio = 16 / 9;
			let sx = 0;
			let sy = 0;
			let sw = media.videoWidth;
			let sh = media.videoHeight;
			if (sw / sh > ratio) {
				sw = sh * ratio;
				sx = (media.videoWidth - sw) / 2;
			} else {
				sh = sw / ratio;
				sy = (media.videoHeight - sh) / 2;
			}
			try {
				ctx.drawImage(media, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
				previewUrl = canvas.toDataURL('image/jpeg', 0.75);
			} catch {
				// frame not ready yet
			}
		};
		media.addEventListener('seeked', draw);
		media.addEventListener('loadeddata', draw);
		return () => {
			cancelled = true;
			media.removeEventListener('seeked', draw);
			media.removeEventListener('loadeddata', draw);
			media.removeAttribute('src');
			media.load();
			previewMedia = null;
		};
	});

	$effect(() => {
		const target = hoverTime;
		if (target === null || !previewMedia || !previewMedia.videoWidth) return;
		clearTimeout(previewTimer);
		const time = clamp(target, 0, Math.max(0, duration - 0.05));
		previewTimer = setTimeout(() => {
			if (previewMedia && Math.abs(previewMedia.currentTime - time) > 0.08) {
				try {
					previewMedia.currentTime = time;
				} catch {
					// keep the previous frame
				}
			}
		}, 70);
	});

	$effect(() => {
		return () => {
			clearInterval(sleepTimer);
			clearTimeout(previewTimer);
			window.removeEventListener('pointermove', onSeekWindowMove);
			window.removeEventListener('pointerup', onSeekWindowUp);
			window.removeEventListener('pointercancel', onSeekWindowUp);
			if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
			void audioCtx?.close().catch(() => {});
		};
	});

	$effect(() => {
		const onChange = () => {
			fullscreen = document.fullscreenElement === container;
		};
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	});

	$effect(() => {
		return () => saveProgress(false);
	});

	function wakeControls() {
		controlsVisible = true;
		clearTimeout(hideTimer);
		if (playing) {
			hideTimer = setTimeout(() => {
				if (!settingsOpen && !seeking) controlsVisible = false;
			}, 2800);
		}
	}

	async function onCanPlay() {
		waiting = false;
		if (videoEl && Number.isFinite(videoEl.duration)) duration = videoEl.duration;
		if (started || !videoEl) return;
		started = true;
		try {
			await videoEl.play();
		} catch {
			if (!videoEl) return;
			muted = true;
			autoMuted = true;
			videoEl.muted = true;
			videoEl.play().catch(() => {});
		}
	}

	async function togglePlay() {
		if (!videoEl) return;
		if (videoEl.paused) {
			try {
				await videoEl.play();
			} catch {
				muted = true;
				autoMuted = true;
				videoEl.muted = true;
				videoEl.play().catch(() => {});
			}
		} else {
			videoEl.pause();
		}
		wakeControls();
	}

	function onLoadedMetadata() {
		if (!videoEl) return;
		duration = Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
		if (!resumed && initialProgress > 3 && initialProgress < duration - 5) {
			videoEl.currentTime = initialProgress;
		}
		resumed = true;
	}

	function onTimeUpdate() {
		if (!videoEl) return;
		currentTime = videoEl.currentTime;
		playing = !videoEl.paused;
		waiting = false;
		if (duration <= 0 && Number.isFinite(videoEl.duration)) duration = videoEl.duration;
		if (videoEl.buffered.length > 0 && duration > 0) {
			buffered = (videoEl.buffered.end(videoEl.buffered.length - 1) / duration) * 100;
		}
		if (videoEl.currentTime - lastSaved > 10) {
			lastSaved = videoEl.currentTime;
			saveProgress(false);
		}
	}

	function saveProgress(completed: boolean) {
		if (live || !videoId) return;
		const payload = JSON.stringify({ videoId, progress: Math.floor(currentTime), completed });
		fetch('/api/progress', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: payload,
			keepalive: true
		}).catch(() => {});
	}

	function seekTo(clientX: number) {
		if (!seekBar || !videoEl || duration <= 0) return;
		const rect = seekBar.getBoundingClientRect();
		const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
		videoEl.currentTime = ratio * duration;
		currentTime = videoEl.currentTime;
	}

	function onSeekWindowMove(event: PointerEvent) {
		if (!seeking) return;
		seekTo(event.clientX);
		if (!seekBar || duration <= 0) return;
		const rect = seekBar.getBoundingClientRect();
		const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
		hoverTime = ratio * duration;
		hoverX = ratio * rect.width;
	}

	function onSeekWindowUp() {
		if (!seeking) return;
		seeking = false;
		window.removeEventListener('pointermove', onSeekWindowMove);
		wakeControls();
	}

	function onSeekPointerDown(event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		seeking = true;
		seekTo(event.clientX);
		window.addEventListener('pointermove', onSeekWindowMove);
		window.addEventListener('pointerup', onSeekWindowUp);
		window.addEventListener('pointercancel', onSeekWindowUp);
	}

	function onSeekPointerMove(event: PointerEvent) {
		if (live || !seekBar || duration <= 0 || seeking) return;
		const rect = seekBar.getBoundingClientRect();
		const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
		hoverTime = ratio * duration;
		hoverX = ratio * rect.width;
	}

	function onVolumeInput(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		volume = value;
		muted = value === 0;
		autoMuted = false;
		localStorage.setItem('vuetube:volume', String(value));
	}

	function toggleMute() {
		muted = !muted;
		autoMuted = false;
		if (!muted && volume === 0) volume = 0.6;
	}

	function lowerVolume() {
		volume = Math.max(0, Math.round((volume - 0.2) * 10) / 10);
		muted = volume === 0;
		autoMuted = muted;
		localStorage.setItem('vuetube:volume', String(volume));
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await container?.requestFullscreen();
		} catch {
			// ignore
		}
	}

	function setRate(value: number) {
		rate = value;
		settingsView = 'main';
	}

	$effect(() => {
		if (live) return;
		let cancelled = false;
		fetch(`/api/videos/${videoId}/qualities`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data: { qualities: QualityOption[] } | null) => {
				if (cancelled || !data?.qualities?.length) return;
				availableQualities = data.qualities;
				const source =
					data.qualities.find((item) => item.source) ??
					data.qualities.find((item) => item.url === src) ??
					data.qualities[data.qualities.length - 1];
				if (source) {
					qualityChoice = source.quality;
					selectedQualityUrl = source.url;
				}
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	function setQuality(option: QualityOption) {
		if (!videoEl) return;
		if (option.url === selectedQualityUrl) {
			settingsView = 'main';
			settingsOpen = false;
			return;
		}
		const el = videoEl;
		const time = el.currentTime;
		const wasPlaying = !el.paused;
		waiting = true;
		error = false;
		el.src = option.url;
		el.load();
		el.addEventListener(
			'loadedmetadata',
			() => {
				if (time > 0 && time < (Number.isFinite(el.duration) ? el.duration : 0)) el.currentTime = time;
				if (wasPlaying) el.play().catch(() => {});
			},
			{ once: true }
		);
		selectedQualityUrl = option.url;
		qualityChoice = option.quality;
		settingsView = 'main';
		settingsOpen = false;
		announce(`Качество ${option.quality}`);
	}

	let clickTimer: ReturnType<typeof setTimeout> | undefined;

	function onVideoClick() {
		clearTimeout(clickTimer);
		clickTimer = setTimeout(() => togglePlay(), 200);
	}

	function onVideoDoubleClick() {
		clearTimeout(clickTimer);
		toggleFullscreen();
	}

	function onKeydown(event: KeyboardEvent) {
		if (!videoEl) return;
		const target = event.target as HTMLElement;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

		switch (event.key) {
			case ' ':
			case 'k':
				event.preventDefault();
				togglePlay();
				break;
			case 'ArrowRight':
				event.preventDefault();
				videoEl.currentTime = clamp(videoEl.currentTime + 5, 0, duration);
				break;
			case 'ArrowLeft':
				event.preventDefault();
				videoEl.currentTime = clamp(videoEl.currentTime - 5, 0, duration);
				break;
			case 'ArrowUp':
				event.preventDefault();
				volume = clamp(volume + 0.1, 0, 1);
				muted = false;
				break;
			case 'ArrowDown':
				event.preventDefault();
				volume = clamp(volume - 0.1, 0, 1);
				break;
			case 'm':
				toggleMute();
				break;
			case 'f':
				toggleFullscreen();
				break;
		}
		wakeControls();
	}

	const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
</script>

<div
	bind:this={container}
	class="player group relative aspect-video w-full overflow-hidden bg-black select-none {edgeToEdge ? '' : 'rounded-[20px] 2xl:rounded-[28px]'}"
	onpointermove={wakeControls}
	onpointerleave={() => playing && (controlsVisible = false)}
	onkeydown={onKeydown}
	tabindex="-1"
	role="region"
	aria-label="Видеоплеер"
>
	<video
		bind:this={videoEl}
		src={live ? undefined : src}
		poster={poster ?? undefined}
		autoplay
		playsinline
		class="h-full w-full object-contain"
		preload="auto"
		onloadedmetadata={onLoadedMetadata}
		ontimeupdate={onTimeUpdate}
		onplay={() => {
			playing = true;
			ended = false;
			waiting = false;
			wakeControls();
			announce('Воспроизведение');
		}}
		onpause={() => {
			playing = false;
			controlsVisible = true;
			clearTimeout(hideTimer);
			saveProgress(false);
			announce('Пауза');
		}}
		onended={() => {
			playing = false;
			ended = true;
			controlsVisible = true;
			saveProgress(true);
			if (autoOff) {
				clearInterval(sleepTimer);
				autoOff = false;
				sleepLeft = 0;
			}
			announce('Видео завершено');
		}}
		onwaiting={() => (waiting = true)}
		onplaying={() => (waiting = false)}
		oncanplay={onCanPlay}
		onerror={() => {
			error = true;
			waiting = false;
		}}
		onclick={onVideoClick}
		ondblclick={onVideoDoubleClick}
	></video>

	{#if waiting && !error && !playing}
		<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
			<div class="loader-ring"></div>
		</div>
	{/if}

	{#if error}
		<div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white backdrop-blur-md">
			<span class="flex h-14 w-14 items-center justify-center rounded-[16px] bg-white/10">
				<Icon name="info" size={28} strokeWidth={2.6} />
			</span>
			<p class="text-[15px] font-semibold">Не удалось воспроизвести видео</p>
			<p class="max-w-sm text-[12px] text-white/60">Файл повреждён, перемещён или формат не поддерживается браузером.</p>
		</div>
	{/if}

	{#if autoMuted && playing && !error}
		<button
			class="absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-[12px] bg-black/65 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur-md transition duration-200 hover:bg-black/85"
			onclick={toggleMute}
			transition:fly={{ y: -8, duration: 200 }}
		>
			<Icon name="volumeX" size={17} strokeWidth={2.6} />
			Включить звук
		</button>
	{/if}

	{#if !playing && !error && !waiting}
		<button
			class="absolute inset-0 z-10 flex items-center justify-center"
			onclick={togglePlay}
			aria-label="Воспроизвести"
			transition:scale={{ duration: 220, start: 0.85 }}
		>
			<span class="center-play" in:scale={{ duration: 260, start: 0.7 }}>
				<Icon name={ended ? 'history' : 'play'} size={72} filled={!ended} strokeWidth={2.2} />
			</span>
		</button>
	{/if}

	{#if subtitles && subtitleCues.length}
		{@const activeCue = subtitleCues.find((cue) => currentTime >= cue.start && currentTime < cue.end)}
		{#if activeCue}
			<div
				class="subtitle-overlay absolute z-20 max-w-[85%] cursor-move select-none rounded-[14px] border border-white/10 bg-black/35 px-5 py-2.5 text-center text-[20px] font-semibold leading-snug tracking-[0.01em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-colors duration-200 hover:bg-black/50"
				style="left:{subtitlePos.x}%; top:{subtitlePos.y}%; transform:translate(-50%, -50%); text-shadow:0 2px 8px rgba(0,0,0,0.95);"
				onpointerdown={onSubtitlePointerDown}
				onpointermove={onSubtitlePointerMove}
				onpointerup={onSubtitlePointerUp}
				role="status"
				aria-live="polite"
			>
				{activeCue.text}
			</div>
		{/if}
	{/if}

	<div
		class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-black/80 via-black/25 to-transparent transition-opacity duration-300"
		class:opacity-0={!controlsVisible}
		class:opacity-100={controlsVisible}
	></div>

	<div
		class="control-dock absolute inset-x-4 bottom-3 z-20 text-white transition-all duration-300 sm:inset-x-5"
		class:opacity-0={!controlsVisible}
		class:translate-y-3={!controlsVisible}
		class:pointer-events-none={!controlsVisible}
	>
		<div
			bind:this={seekBar}
			class="group/seek relative flex h-7 touch-none cursor-pointer items-center"
			onpointerdown={live ? undefined : onSeekPointerDown}
			onpointermove={onSeekPointerMove}
			onpointerleave={() => (hoverTime = null)}
			role="slider"
			aria-label="Позиция видео"
			aria-valuemin={0}
			aria-valuemax={Math.floor(duration)}
			aria-valuenow={Math.floor(currentTime)}
			tabindex="0"
		>
			<div class="seek-track relative h-1.5 w-full rounded-full bg-white/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] transition-all duration-200 group-hover/seek:h-2" class:h-2={seeking}>
				<div class="absolute inset-y-0 left-0 rounded-full bg-white/25" style="width:{buffered}%"></div>
				<div class="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-white/80 to-white shadow-[0_0_12px_rgba(255,255,255,0.35)]" style="width:{playedPercent}%"></div>
				<div
					class="seek-thumb absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.85),0_0_0_4px_rgba(255,255,255,0.1)] transition-transform duration-200 group-hover/seek:scale-125"
					class:scale-150={seeking}
					style="left:{playedPercent}%"
				></div>
			</div>

			{#if hoverTime !== null}
				<div
					class="pointer-events-none absolute -top-30 -translate-x-1/2 overflow-hidden rounded-[14px] border border-white/12 bg-black/70 shadow-[0_18px_45px_rgba(0,0,0,0.7)] backdrop-blur-xl"
					style="left:{clamp(hoverX, 84, (seekBar?.clientWidth ?? 300) - 84)}px"
					transition:fly={{ y: 8, duration: 160 }}
				>
					{#if previewUrl}
						<img src={previewUrl} alt="" class="h-[84px] w-[150px] object-cover brightness-105" />
					{:else}
						<div class="h-[84px] w-[150px] animate-pulse bg-white/10"></div>
					{/if}
					<div class="border-t border-white/10 bg-gradient-to-b from-white/8 to-transparent px-2 py-1.5 text-center text-[11px] font-bold tabular-nums tracking-wide text-white">
						{formatDuration(hoverTime)}
					</div>
				</div>
			{/if}
		</div>

		<div class="mt-1.5 flex items-center gap-1">
			<button class="play-toggle" onclick={togglePlay} aria-label={playing ? 'Пауза' : 'Играть'} title={playing ? 'Пауза (K)' : 'Играть (K)'}>
				<Icon name={playing ? 'pause' : 'play'} size={28} filled strokeWidth={2.6} />
			</button>

			<div class="group/volume flex items-center">
				<button class="ctrl-btn" onclick={toggleMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'} title="Звук (M)">
					<Icon name={muted || volume === 0 ? 'volumeX' : 'volume'} size={20} strokeWidth={2.6} />
				</button>
				<button class="ctrl-btn" onclick={lowerVolume} aria-label="Убавить звук" title="Убавить звук">−</button>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={muted ? 0 : volume}
					oninput={onVolumeInput}
					class="volume-range h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-200 group-hover/volume:w-20 group-hover/volume:opacity-100"
					aria-label="Громкость"
				/>
			</div>

			{#if live}
				<span class="ml-2 inline-flex items-center gap-1.5 rounded-[8px] bg-(--bg-elevated) px-2 py-1 text-[11px] font-bold text-white">
					<span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>LIVE
				</span>
			{:else}
				<span class="time-label ml-2 text-[12px] font-bold tabular-nums text-white">
					{formatDuration(currentTime)} <span class="text-white/45">/ {formatDuration(duration)}</span>
				</span>
			{/if}

			<div class="ml-auto flex items-center gap-1">
				{#if ended}
					<button class="ctrl-pill" onclick={() => { if (videoEl) { videoEl.currentTime = 0; videoEl.play(); } }}>
						<Icon name="history" size={16} strokeWidth={2.6} />
						Смотреть снова
					</button>
				{/if}

				<div class="relative" use:clickOutside={() => (settingsOpen = false)}>
					<button
						class="ctrl-btn"
						onclick={() => {
							settingsOpen = !settingsOpen;
							if (settingsOpen) settingsView = 'main';
						}}
						aria-label="Настройки плеера"
						title="Настройки"
					>
						<Icon name="settings" size={22} strokeWidth={2.6} />
					</button>

					{#if settingsOpen}
						<div class="settings-panel absolute right-0 bottom-12 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] border border-white/12 bg-linear-to-b from-white/8 to-black/55 p-1.5 text-white shadow-[0_22px_60px_-12px_rgba(0,0,0,0.85)] backdrop-blur-2xl" transition:fly={{ y: 10, duration: 180 }}>
							{#if settingsView === 'main'}
								<div class="set-row">
									<Icon name="volume" size={19} strokeWidth={2.6} />
									<span class="set-label">Постоянный уровень громкости</span>
									<button class="switch" class:switch-on={normalize} onclick={() => toggleAudio('normalize')} aria-label="Постоянный уровень громкости"><span></span></button>
								</div>
								<div class="set-row">
									<Icon name="mic" size={19} strokeWidth={2.6} />
									<span class="set-label">Усиление голоса</span>
									<button class="switch" class:switch-on={voiceBoost} onclick={() => toggleAudio('voiceBoost')} aria-label="Усиление голоса"><span></span></button>
								</div>
								<div class="set-row">
									<Icon name="bell" size={19} strokeWidth={2.6} />
									<span class="set-label">Анонсаторы</span>
									<button class="switch" class:switch-on={announcer} onclick={toggleAnnouncer} aria-label="Анонсаторы"><span></span></button>
								</div>
								<div class="my-1 h-px bg-white/10"></div>
								<button class="set-nav" onclick={() => (settingsView = 'subtitles')}>
									<Icon name="captions" size={19} strokeWidth={2.6} />
									<span class="set-label">Субтитры</span>
									<span class="set-value">{subtitles ? 'Вкл.' : 'Выкл.'}</span>
									<Icon name="chevronRight" size={16} strokeWidth={2.6} />
								</button>
								<button class="set-nav" onclick={toggleAutoOff}>
									<Icon name="clock" size={19} strokeWidth={2.6} />
									<span class="set-label">Автовыключение</span>
									<span class="set-value">{autoOff ? formatDuration(sleepLeft) : 'Выкл.'}</span>
									<Icon name="chevronRight" size={16} strokeWidth={2.6} />
								</button>
								<button class="set-nav" onclick={() => (settingsView = 'speed')}>
									<Icon name="clock" size={19} strokeWidth={2.6} />
									<span class="set-label">Скорость воспроизведения</span>
									<span class="set-value">{rate === 1 ? 'Обычная' : `${rate}×`}</span>
									<Icon name="chevronRight" size={16} strokeWidth={2.6} />
								</button>
								{#if !live}
									<button class="set-nav" onclick={() => (settingsView = 'quality')}>
										<Icon name="settings" size={19} strokeWidth={2.6} />
										<span class="set-label">Качество</span>
										<span class="set-value">{qualityChoice}</span>
										<Icon name="chevronRight" size={16} strokeWidth={2.6} />
									</button>
								{/if}
							{:else if settingsView === 'speed'}
								<button class="set-nav" onclick={() => (settingsView = 'main')}>
									<Icon name="arrowLeft" size={18} strokeWidth={2.6} />
									<span class="set-label font-bold">Скорость воспроизведения</span>
								</button>
								<div class="my-1 h-px bg-white/10"></div>
								{#each speeds as speed (speed)}
									<button class="set-nav" onclick={() => setRate(speed)}>
										<span class="set-label">{speed === 1 ? 'Обычная' : `${speed}×`}</span>
										{#if rate === speed}<Icon name="check" size={16} strokeWidth={2.6} />{/if}
									</button>
								{/each}
							{:else if settingsView === 'subtitles'}
								<button class="set-nav" onclick={() => (settingsView = 'main')}>
									<Icon name="arrowLeft" size={18} strokeWidth={2.6} />
									<span class="set-label font-bold">Субтитры</span>
								</button>
								<div class="my-1 h-px bg-white/10"></div>
								<div class="set-row">
									<Icon name="captions" size={19} strokeWidth={2.6} />
									<span class="set-label">Показывать</span>
									<button
										class="switch"
										class:switch-on={subtitles}
										onclick={() => {
											subtitles = !subtitles;
											localStorage.setItem(`vuetube:subtitles:${videoId}`, subtitles ? 'on' : 'off');
										}}
										aria-label="Показывать субтитры"
									><span></span></button>
								</div>
								{#if canEdit && subtitleDraft}
									<div class="px-2 pb-2">
										<span class="mb-1.5 block text-[11px] font-semibold text-white/60">Текст субтитров — можно исправить</span>
										<textarea
											bind:value={subtitleDraft}
											rows="5"
											class="w-full resize-y rounded-[10px] bg-white/10 px-2.5 py-2 font-mono text-[10px] leading-snug text-white outline-none"
										></textarea>
										<button
											class="mt-2 w-full rounded-[10px] bg-white/15 py-1.5 text-[12px] font-semibold transition hover:bg-white/25 disabled:opacity-50"
											onclick={saveSubtitles}
											disabled={savingSubtitles}
										>
											{savingSubtitles ? 'Сохраняем…' : 'Сохранить'}
										</button>
									</div>
								{/if}
							{:else}
								<button class="set-nav" onclick={() => (settingsView = 'main')}>
									<Icon name="arrowLeft" size={18} strokeWidth={2.6} />
									<span class="set-label font-bold">Качество</span>
								</button>
								<div class="my-1 h-px bg-white/10"></div>
								{#each availableQualities as item (item.url)}
									<button class="set-nav" onclick={() => setQuality(item)}>
										<span class="set-label">
											{item.quality}
											{#if !item.source}<span class="block text-[10px] font-normal text-white/40">для медленного интернета</span>{/if}
										</span>
										{#if item.width && item.height}
											<span class="set-value tabular-nums">{item.width}×{item.height}</span>
										{/if}
										{#if selectedQualityUrl === item.url}<Icon name="check" size={16} strokeWidth={2.6} />{/if}
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				{#if ontheater}
					<button class="ctrl-btn max-sm:hidden" onclick={ontheater} aria-label="Широкий режим" title="Широкий режим">
						<Icon name="theater" size={20} strokeWidth={2.6} />
					</button>
				{/if}

				<button class="ctrl-btn" onclick={toggleFullscreen} aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'} title="Полный экран (F)">
					<Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} size={20} strokeWidth={2.6} />
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.player:fullscreen {
		aspect-ratio: auto;
		border-radius: 0;
	}
	.player:fullscreen video {
		height: 100%;
		width: 100%;
	}
	.player:fullscreen .control-dock {
		inset-inline: 24px;
		bottom: 24px;
	}

	.ctrl-btn {
		display: inline-flex;
		height: 40px;
		width: 40px;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		transition: background-color 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
	}
	.ctrl-btn:hover {
		background: linear-gradient(180deg, rgb(255 255 255 / 0.2), rgb(255 255 255 / 0.1));
		box-shadow: 0 6px 18px -8px rgb(255 255 255 / 0.5);
		transform: scale(1.1);
	}
	.ctrl-btn:active {
		transform: scale(0.94);
	}

	.play-toggle {
		display: inline-flex;
		height: 46px;
		width: 46px;
		align-items: center;
		justify-content: center;
		margin-right: 6px;
		color: #fff;
		filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.95));
		transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease;
	}
	.play-toggle:hover {
		transform: scale(1.18);
		filter: drop-shadow(0 6px 16px rgb(0 0 0 / 1));
	}
	.play-toggle:active {
		transform: scale(0.9);
	}
	.toggle-icon {
		display: inline-flex;
	}

	.time-label,
	.seek-track,
	.ctrl-pill {
		text-shadow: 0 1px 6px rgb(0 0 0 / 0.9);
	}

	.set-row,
	.set-nav {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 12px;
		min-height: 40px;
		border-radius: 11px;
		padding: 8px 10px;
		text-align: left;
		transition: background-color 0.18s ease;
	}
	.set-nav:hover,
	.set-row:hover {
		background: rgb(255 255 255 / 0.1);
	}
	.set-label {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.set-value {
		flex-shrink: 0;
		font-size: 12px;
		font-weight: 600;
		color: rgb(255 255 255 / 0.55);
	}
	.switch {
		display: inline-flex;
		align-items: center;
		width: 38px;
		height: 22px;
		flex-shrink: 0;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.2);
		padding: 3px;
		transition: background-color 0.2s ease;
	}
	.switch span {
		height: 16px;
		width: 16px;
		border-radius: 999px;
		background: #fff;
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.switch-on {
		background: #fff;
	}
	.switch-on span {
		background: #050505;
		transform: translateX(16px);
	}
	.seek-thumb {
		box-shadow:
			0 2px 12px rgb(0 0 0 / 0.85),
			0 0 0 4px rgb(255 255 255 / 0.1);
	}

	.ctrl-pill {
		display: inline-flex;
		height: 36px;
		align-items: center;
		gap: 8px;
		border-radius: 10px;
		padding: 0 12px;
		font-size: 12px;
		font-weight: 700;
		transition: background-color 0.18s ease, transform 0.18s ease;
	}
	.ctrl-pill:hover {
		background: rgb(255 255 255 / 0.15);
	}
	.ctrl-pill:active {
		transform: scale(0.97);
	}

	.center-play {
		display: inline-flex;
		color: #fff;
		filter: drop-shadow(0 10px 30px rgb(0 0 0 / 0.95));
		animation: play-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.center-play:hover {
		transform: scale(1.12);
	}
	.center-play:active {
		transform: scale(0.94);
	}
	@keyframes play-pop {
		from {
			opacity: 0;
			transform: scale(0.7);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.loader-ring {
		height: 48px;
		width: 48px;
		border-radius: 999px;
		border: 4px solid rgb(255 255 255 / 0.18);
		border-top-color: #fff;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		height: 14px;
		width: 14px;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.5);
		cursor: pointer;
	}
</style>
