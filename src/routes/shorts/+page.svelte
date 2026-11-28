<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import FormattedDescription from '#lib/components/FormattedDescription.svelte';
	import CommentMenu from '#lib/components/CommentMenu.svelte';
	import VerifiedBadge from '#lib/components/VerifiedBadge.svelte';
	import { clickOutside } from '#lib/actions/clickOutside';
	import { toasts } from '#lib/stores/toast.svelte';
	import { formatCompact, formatViews, timeAgo } from '#lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const user = $derived(page.data.user);

	const initialIndex = $derived(
		data.initialId ? Math.max(0, data.shorts.findIndex((s) => s.id === data.initialId)) : 0
	);
	let index = $state(0);
	let initialized = false;
	$effect(() => {
		if (!initialized && data.shorts.length) {
			index = initialIndex;
			initialized = true;
		}
	});

	let hiddenIds = $state<string[]>([]);
	let hiddenChannels = $state<string[]>([]);
	const visibleShorts = $derived(
		data.shorts.filter((s) => !hiddenIds.includes(s.id) && !hiddenChannels.includes(s.user.id))
	);
	const current = $derived(visibleShorts[index]);
	let videoEl = $state<HTMLVideoElement>();
	let frameEl = $state<HTMLDivElement>();
	let direction = $state(1);
	let touchStartY = $state(0);
	let muted = $state(false);
	let volume = $state(0.5);
	let soundBlocked = $state(false);
	let volumeBar = $state<HTMLDivElement>();
	let volumeDragging = $state(false);
	let commentsOpen = $state(false);
	let comments = $state<{ id: string; content: string; createdAt: string; likeCount: number; user: { name: string; image: string | null; id: string; verified?: boolean; creator?: boolean }; pinned?: boolean; replies: { id: string; content: string; createdAt: string; user: { name: string; image: string | null; id: string } }[] }[]>([]);
	let commentText = $state('');
	let replyTo = $state<string | null>(null);
	let replyText = $state('');
	let expandedReplies = $state<string[]>([]);
	let likedComments = $state<Record<string, boolean>>({});
	let dislikedComments = $state<Record<string, boolean>>({});
	let playing = $state(false);
	let liked = $state(false);
	let disliked = $state(false);
	let likeBurst = $state(false);
	let reposted = $state(false);
	let sheet = $state<'share' | 'repost' | 'sound' | null>(null);
	let likeCount = $state(0);
	let progress = $state(0);
	let shortTime = $state(0);
	let wheelLock = false;
	let subscribed = $state(false);
	let subscriberCount = $state(0);
	let subscribeLoading = $state(false);
	let menuOpen = $state(false);
	let menuView = $state<'main' | 'speed' | 'report'>('main');
	let rate = $state(1);
	let descriptionOpen = $state(false);
	let saved = $state(false);
	let captionsOn = $state(false);
	let shortCues = $state<{ start: number; end: number; text: string }[]>([]);
	let captionText = $state('');
	const isOwn = $derived(Boolean(user && current && user.id === current.user.id));

	$effect(() => {
		if (!videoEl) return;
		videoEl.muted = muted;
		videoEl.volume = volume;
	});

	$effect(() => {
		const stored = localStorage.getItem('vuetube:shorts-volume');
		if (stored !== null) {
			const value = Number(stored);
			if (Number.isFinite(value)) volume = Math.min(1, Math.max(0, value));
		}
		muted = false;
	});

	function setVolumeFromX(clientX: number) {
		if (!volumeBar) return;
		const rect = volumeBar.getBoundingClientRect();
		if (!rect.width) return;
		const value = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
		volume = Math.round(value * 1000) / 1000;
		muted = volume === 0;
		soundBlocked = false;
		localStorage.setItem('vuetube:shorts-volume', String(volume));
	}

	function onVolumePointerDown(event: PointerEvent) {
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// synthetic pointers may not support capture
		}
		volumeDragging = true;
		setVolumeFromX(event.clientX);
	}

	function onVolumePointerMove(event: PointerEvent) {
		if (volumeDragging) setVolumeFromX(event.clientX);
	}

	function onVolumePointerUp(event: PointerEvent) {
		if (!volumeDragging) return;
		volumeDragging = false;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {
			// pointer capture may already be gone
		}
	}

	$effect(() => {
		if (!current) return;
		liked = false;
		commentsOpen = false;
		comments = [];
		likeCount = current.likeCount;
		progress = 0;
		loadReaction();
		if (videoEl) {
			videoEl.currentTime = 0;
			videoEl.muted = false;
			videoEl.play().catch(() => {
				muted = true;
				soundBlocked = true;
				videoEl!.muted = true;
				videoEl!.play().catch(() => {});
			});
		}
	});

	$effect(() => {
		if (index >= visibleShorts.length) index = Math.max(0, visibleShorts.length - 1);
	});

	$effect(() => {
		if (!current) return;
		descriptionOpen = false;
		menuOpen = false;
		menuView = 'main';
		captionsOn = false;
		captionText = '';
		shortCues = [];
		saved = Boolean(localStorage.getItem(`vuetube:saved:${current.id}`));
		reposted = Boolean(localStorage.getItem(`vuetube:reposted:${current.id}`));
		likeBurst = false;
		subscribed = false;
		subscriberCount = 0;
		if (videoEl) videoEl.playbackRate = rate;
		if (!user || user.id === current.user.id) return;
		fetch(`/api/channels/${current.user.id}/subscribe`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data: { subscribed?: boolean; count?: number } | null) => {
				if (data) {
					subscribed = Boolean(data.subscribed);
					subscriberCount = Number(data.count ?? 0);
				}
			})
			.catch(() => {});
		fetch(`/api/videos/${current.id}/subtitles`)
			.then((res) => (res.ok ? res.text() : ''))
			.then((text) => {
				if (!text) return;
				shortCues = parseShortVtt(text);
			})
			.catch(() => {});
	});

	$effect(() => {
		const i = index;
		const el = frameEl;
		if (i < 0 || !el || !initialized) return;
		el.animate(
			[
				{ transform: `translateY(${direction * 64}px) scale(0.98)`, opacity: 0.3 },
				{ transform: 'translateY(0) scale(1)', opacity: 1 }
			],
			{ duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
		);
	});

	function next() {
		if (index < visibleShorts.length - 1) {
			direction = 1;
			index += 1;
			history.replaceState(null, '', `/shorts?v=${visibleShorts[index].id}`);
		}
	}

	function prev() {
		if (index > 0) {
			direction = -1;
			index -= 1;
			history.replaceState(null, '', `/shorts?v=${visibleShorts[index].id}`);
		}
	}

	function onWheel(event: WheelEvent) {
		if (wheelLock) return;
		wheelLock = true;
		setTimeout(() => (wheelLock = false), 600);
		if (event.deltaY > 0) next();
		else prev();
	}

	function onTouchStart(event: TouchEvent) {
		touchStartY = event.touches[0]?.clientY ?? 0;
	}

	function onTouchEnd(event: TouchEvent) {
		const delta = touchStartY - (event.changedTouches[0]?.clientY ?? touchStartY);
		if (Math.abs(delta) < 60) return;
		if (delta > 0) next();
		else prev();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
		if (event.key === 'ArrowDown') { event.preventDefault(); next(); }
		if (event.key === 'ArrowUp') { event.preventDefault(); prev(); }
	}

	function togglePlay() {
		if (!videoEl) return;
		if (videoEl.paused) videoEl.play().catch(() => {});
		else videoEl.pause();
	}

	function onTimeUpdate() {
		if (!videoEl || !videoEl.duration) return;
		shortTime = videoEl.currentTime;
		progress = (videoEl.currentTime / videoEl.duration) * 100;
	}

	function parseShortVtt(text: string) {
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
			const text = lines.slice(index + 1).join(' ').trim();
			if (text) cues.push({ start: toSeconds(from), end: toSeconds(to), text });
		}
		return cues;
	}

	const activeCaption = $derived(
		captionsOn ? (shortCues.find((cue) => shortTime >= cue.start && shortTime < cue.end)?.text ?? '') : ''
	);

	async function toggleSubscribe() {
		if (!user || !current || isOwn || subscribeLoading) return;
		const next = !subscribed;
		subscribeLoading = true;
		subscribed = next;
		subscriberCount = Math.max(0, subscriberCount + (next ? 1 : -1));
		try {
			const res = await fetch(`/api/channels/${current.user.id}/subscribe`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ subscribed: next })
			});
			if (!res.ok) throw new Error('failed');
			const data = (await res.json()) as { subscribed: boolean; count: number };
			subscribed = data.subscribed;
			subscriberCount = Number(data.count ?? 0);
			toasts.success(subscribed ? 'Вы подписались на канал' : 'Вы отписались от канала');
		} catch {
			subscribed = !next;
			subscriberCount = Math.max(0, subscriberCount + (next ? -1 : 1));
			toasts.error('Не удалось изменить подписку');
		} finally {
			subscribeLoading = false;
		}
	}

	function toggleRepost() {
		if (!current) return;
		sheet = null;
		const key = `vuetube:reposted:${current.id}`;
		if (reposted) {
			localStorage.removeItem(key);
			reposted = false;
			toasts.success('Репост удалён');
		} else {
			localStorage.setItem(key, '1');
			reposted = true;
			toasts.success('Репост сохранён');
		}
	}

	function openSheet(type: 'share' | 'repost' | 'sound') {
		sheet = sheet === type ? null : type;
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toasts.success('Ссылка скопирована');
		} catch {
			toasts.error('Не удалось скопировать ссылку');
		}
		sheet = null;
	}

	function downloadVideo() {
		if (!current) return;
		const link = document.createElement('a');
		link.href = current.videoUrl;
		link.download = `${current.title.slice(0, 60) || 'short'}.mp4`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		toasts.success('Скачивание началось');
		sheet = null;
	}

	async function react(type: -1 | 0 | 1) {
		if (!current) return;
		const res = await fetch(`/api/videos/${current.id}/reaction`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ type })
		});
		if (res.ok) {
			const data = (await res.json()) as { likes: number; reaction: number };
			likeCount = data.likes;
			liked = data.reaction === 1;
			disliked = data.reaction === -1;
			if (liked) {
				likeBurst = true;
				setTimeout(() => (likeBurst = false), 620);
			}
		}
		sheet = null;
	}

	function toggleSaved() {
		if (!current) return;
		sheet = null;
		const key = `vuetube:saved:${current.id}`;
		if (saved) {
			localStorage.removeItem(key);
			saved = false;
			toasts.success('Удалено из сохранённого');
		} else {
			localStorage.setItem(key, '1');
			saved = true;
			toasts.success('Видео сохранено');
		}
		menuOpen = false;
	}

	function setRate(value: number) {
		rate = value;
		if (videoEl) videoEl.playbackRate = value;
		menuView = 'main';
		menuOpen = false;
		toasts.success(value === 1 ? 'Обычная скорость' : `Скорость ${value}×`);
	}

	function notInterested() {
		if (!current) return;
		hiddenIds = [...hiddenIds, current.id];
		menuOpen = false;
		toasts.success('Видео скрыто из ленты');
		if (index >= visibleShorts.length) index = Math.max(0, visibleShorts.length - 1);
	}

	function hideChannel() {
		if (!current) return;
		hiddenChannels = [...hiddenChannels, current.user.id];
		menuOpen = false;
		toasts.success('Видео этого канала больше не будут рекомендоваться');
		if (index >= visibleShorts.length) index = Math.max(0, visibleShorts.length - 1);
	}

	async function report(reason: string) {
		if (!current) return;
		const res = await fetch(`/api/videos/${current.id}/report`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ reason })
		});
		menuOpen = false;
		menuView = 'main';
		toasts.success(res.ok ? 'Жалоба отправлена' : 'Не удалось отправить жалобу');
	}

	function toggleLike() {
		if (!current) return;
		const nextLiked = !liked;
		liked = nextLiked;
		likeCount += nextLiked ? 1 : -1;
		if (nextLiked) {
			likeBurst = true;
			setTimeout(() => (likeBurst = false), 620);
		}
		fetch(`/api/videos/${current.id}/reaction`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ type: nextLiked ? 1 : 0 })
		})
			.then((res) => (res.ok ? res.json() : null))
			.then((data: { likes?: number } | null) => {
				if (data && typeof data.likes === 'number') likeCount = data.likes;
			})
			.catch(() => {});
	}

	async function loadComments() {
		if (!current) return;
		const res = await fetch(`/api/videos/${current.id}/comments`);
		if (res.ok) comments = (await res.json()).comments;
	}

	async function loadReaction() {
		if (!current) return;
		const res = await fetch(`/api/videos/${current.id}/reaction`);
		if (res.ok) {
			const reaction = (await res.json()).reaction as number;
			liked = reaction === 1;
			disliked = reaction === -1;
		}
	}

	async function likeComment(comment: { id: string; likeCount: number }) {
		if (!user) return;
		const liked = !likedComments[comment.id];
		likedComments = { ...likedComments, [comment.id]: liked };
		comment.likeCount = Math.max(0, comment.likeCount + (liked ? 1 : -1));
		comments = [...comments];
		try {
			const res = await fetch(`/api/comments/${comment.id}/reaction`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ liked })
			});
			if (!res.ok) throw new Error('failed');
			const data = (await res.json()) as { liked: boolean; count: number };
			likedComments = { ...likedComments, [comment.id]: data.liked };
			comment.likeCount = data.count;
			comments = [...comments];
		} catch {
			likedComments = { ...likedComments, [comment.id]: !liked };
			comment.likeCount = Math.max(0, comment.likeCount + (liked ? -1 : 1));
			comments = [...comments];
		}
	}

	function dislikeComment(id: string) {
		if (!user) return;
		const next = !dislikedComments[id];
		dislikedComments = { ...dislikedComments, [id]: next };
		if (next && likedComments[id]) {
			likedComments = { ...likedComments, [id]: false };
		}
		toasts.success('Спасибо за оценку');
	}

	function toggleReplies(id: string) {
		expandedReplies = expandedReplies.includes(id)
			? expandedReplies.filter((item) => item !== id)
			: [...expandedReplies, id];
	}

	async function openComments() {
		commentsOpen = true;
		await Promise.all([loadComments(), loadReaction()]);
	}

	async function postComment(parentId?: string) {
		const body = parentId ? replyText.trim() : commentText.trim();
		if (!current || !body) return;
		const res = await fetch(`/api/videos/${current.id}/comments`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(parentId ? { content: body, parentId } : { content: body })
		});
		if (res.ok) {
			commentText = '';
			replyText = '';
			replyTo = null;
			await loadComments();
		}
	}

</script>

<svelte:head>
	<title>Shorts — VueTube</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#if current}
	<div class="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center gap-3 overflow-hidden px-3 py-3 sm:gap-5" role="region" aria-label="Shorts" onwheel={onWheel} ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
		<div bind:this={frameEl} class="short-frame relative flex h-[calc(100dvh-5.5rem)] max-h-[940px] overflow-hidden rounded-[16px] bg-black shadow-2xl">
			<video
				bind:this={videoEl}
				src={current.videoUrl}
				poster={current.thumbnail ?? undefined}
				autoplay
				loop
				playsinline
				muted={muted}
				class="h-full w-full object-contain"
				onplay={() => (playing = true)}
				onpause={() => (playing = false)}
				ontimeupdate={onTimeUpdate}
				onclick={togglePlay}
			></video>

			<div class="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2">
				<div class="flex items-center gap-1.5">
					<button class="top-glass" onclick={() => { muted = !muted; soundBlocked = false; }} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
						<Icon name={muted ? 'volumeX' : 'volume'} size={17} strokeWidth={2.6} />
					</button>
					<div
						bind:this={volumeBar}
						class="volume-track top-volume"
						role="slider"
						tabindex="0"
						aria-label="Громкость"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={muted ? 0 : Math.round(volume * 100)}
						onpointerdown={onVolumePointerDown}
						onpointermove={onVolumePointerMove}
						onpointerup={onVolumePointerUp}
						onpointercancel={onVolumePointerUp}
					>
						<div class="volume-fill" style="width:{muted ? 0 : volume * 100}%"></div>
						<div class="volume-thumb" class:dragging={volumeDragging} style="left:{muted ? 0 : volume * 100}%"></div>
					</div>
				</div>
				<div class="flex items-center gap-1.5">
				<button class="top-glass" class:active={captionsOn} onclick={() => (captionsOn = !captionsOn)} aria-label="Субтитры" title="Субтитры">
					<Icon name="captions" size={17} strokeWidth={2.6} />
				</button>
				<div class="relative" use:clickOutside={() => (menuOpen = false)}>
					<button class="top-glass" onclick={() => { menuOpen = !menuOpen; if (menuOpen) menuView = 'main'; }} aria-label="Ещё" aria-expanded={menuOpen} title="Ещё">
						<Icon name="moreVertical" size={18} strokeWidth={2.6} />
					</button>
					{#if menuOpen}
						<div class="short-menu absolute top-10 right-0 z-40 w-[268px] overflow-hidden rounded-[16px] border border-white/10 bg-black/85 p-1.5 text-white shadow-2xl backdrop-blur-2xl" transition:fly={{ y: 8, duration: 160 }}>
							{#if menuView === 'main'}
								<button class="short-menu-item" onclick={() => { descriptionOpen = !descriptionOpen; menuOpen = false; }}>
									<Icon name="info" size={17} /> <span>Описание</span>
								</button>
								<button class="short-menu-item" onclick={toggleSaved}>
									<Icon name={saved ? 'check' : 'save'} size={17} /> <span>{saved ? 'Удалить из сохранённого' : 'Добавить в плейлист'}</span>
								</button>
								<button class="short-menu-item" onclick={() => (captionsOn = !captionsOn)}>
									<Icon name="captions" size={17} /> <span>Субтитры</span>
									<span class="menu-value">{captionsOn ? 'Вкл.' : 'Выкл.'}</span>
								</button>
								<button class="short-menu-item" onclick={() => (menuView = 'speed')}>
									<Icon name="clock" size={17} /> <span>Скорость воспроизведения</span>
									<span class="menu-value">{rate === 1 ? 'Обычная' : `${rate}×`}</span>
									<Icon name="chevronRight" size={14} />
								</button>
								<div class="my-1 h-px bg-white/10"></div>
								<button class="short-menu-item" onclick={notInterested}>
									<Icon name="thumbDown" size={17} /> <span>Не интересно</span>
								</button>
								<button class="short-menu-item" onclick={hideChannel}>
									<Icon name="eyeOff" size={17} /> <span>Не рекомендовать канал</span>
								</button>
								<button class="short-menu-item" onclick={() => (menuView = 'report')}>
									<Icon name="info" size={17} /> <span>Пожаловаться</span>
									<Icon name="chevronRight" size={14} />
								</button>
								<a class="short-menu-item" href="/help" onclick={() => (menuOpen = false)}>
									<Icon name="message" size={17} /> <span>Отправить отзыв</span>
								</a>
							{:else if menuView === 'speed'}
								<button class="short-menu-item" onclick={() => (menuView = 'main')}><Icon name="arrowLeft" size={16} /><span class="font-bold">Скорость</span></button>
								<div class="my-1 h-px bg-white/10"></div>
								{#each [0.5, 0.75, 1, 1.25, 1.5, 2] as value (value)}
									<button class="short-menu-item" onclick={() => setRate(value)}>
										<span>{value === 1 ? 'Обычная' : `${value}×`}</span>
										{#if rate === value}<Icon name="check" size={15} class="ml-auto" />{/if}
									</button>
								{/each}
							{:else}
								<button class="short-menu-item" onclick={() => (menuView = 'main')}><Icon name="arrowLeft" size={16} /><span class="font-bold">Пожаловаться</span></button>
								<div class="my-1 h-px bg-white/10"></div>
								<button class="short-menu-item" onclick={() => report('sexual')}>Сексуальный контент</button>
								<button class="short-menu-item" onclick={() => report('violence')}>Насилие или шок</button>
								<button class="short-menu-item" onclick={() => report('copyright')}>Авторские права</button>
								<button class="short-menu-item" onclick={() => report('spam')}>Спам</button>
								<button class="short-menu-item" onclick={() => report('other')}>Другое</button>
							{/if}
						</div>
					{/if}
				</div>
				</div>
			</div>

			{#if soundBlocked && muted}
				<button
					class="absolute bottom-[156px] left-1/2 z-20 -translate-x-1/2 rounded-[10px] bg-black/25 px-3 py-1.5 text-[11px] font-bold text-white"
					onclick={() => { muted = false; soundBlocked = false; }}
				>
					Включить звук
				</button>
			{/if}

			<div class="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/80 via-black/25 to-transparent"></div>

			{#if activeCaption}
				<div class="pointer-events-none absolute inset-x-0 bottom-[156px] z-10 flex justify-center px-6">
					<span class="max-w-[90%] rounded-[12px] bg-black/45 px-3 py-2 text-center text-[14px] font-semibold leading-snug text-white shadow-lg backdrop-blur-md">{activeCaption}</span>
				</div>
			{/if}

			{#if descriptionOpen}
				<div class="short-description absolute inset-x-3 bottom-[156px] z-20 rounded-[16px] bg-black/85 p-4 text-white shadow-2xl backdrop-blur-xl" transition:fly={{ y: 10, duration: 180 }}>
					<div class="mb-2 flex items-center justify-between">
						<span class="text-[12px] font-bold">Описание</span>
						<button class="text-white/60 hover:text-white" onclick={() => (descriptionOpen = false)} aria-label="Закрыть"><Icon name="x" size={16} /></button>
					</div>
					<p class="text-[13px] font-semibold">{current.title}</p>
					{#if current.description}
						<div class="mt-2 max-h-32 overflow-y-auto text-[12px] text-white/70">
							<FormattedDescription text={current.description} />
						</div>
					{:else}
						<p class="mt-2 text-[12px] text-white/60">Описание не добавлено.</p>
					{/if}
					<div class="mt-3 flex flex-wrap items-center gap-4">
						<a href="/watch/{current.id}" class="inline-flex items-center gap-1 text-[11px] font-bold text-white/80">Открыть видео <Icon name="chevronRight" size={13} /></a>
						{#if user?.id === current.userId}
							<a href="/edit/{current.id}" class="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400">Настроить видео <Icon name="edit" size={13} /></a>
						{/if}
					</div>
				</div>
			{/if}

			<div class="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
				<div class="mb-3 flex items-center gap-2.5">
					<a href="/channel/{current.user.id}" class="pointer-events-auto"><Avatar name={current.user.name} image={current.user.image} id={current.user.id} size={34} /></a>
					<a href="/channel/{current.user.id}" class="pointer-events-auto text-[13px] font-bold">@{current.user.name.toLowerCase().replace(/\s+/g, '')}</a>
					{#if user && !isOwn}
						<button
							class="bottom-subscribe pointer-events-auto"
							class:subscribed
							onclick={toggleSubscribe}
							disabled={subscribeLoading}
							aria-label={subscribed ? 'Отписаться' : 'Подписаться'}
						>
							<Icon name={subscribed ? 'check' : 'plus'} size={12} strokeWidth={3} />
							<span>{subscribed ? 'Вы подписаны' : 'Подписаться'}</span>
						</button>
					{/if}
				</div>
				<p class="line-clamp-2 text-[13px] font-medium leading-snug drop-shadow-lg">
					{#if current.hasMusic}<Icon name="music" size={13} class="!inline-block mr-1 align-[-2px]" />{/if}{current.title}
				</p>
			</div>

			<div class="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
				<div class="h-full bg-white transition-[width] duration-200" style="width:{progress}%"></div>
			</div>

			{#if !playing}
				<button class="absolute inset-0 flex items-center justify-center" onclick={togglePlay} aria-label="Играть">
					<span class="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
						<Icon name="play" size={28} filled strokeWidth={2.6} />
					</span>
				</button>
			{/if}

			{#if sheet}
				<div class="sheet-backdrop absolute inset-0 z-50 flex items-end" transition:fly={{ y: 20, duration: 160 }} role="presentation" onclick={() => (sheet = null)}>
					<div class="sheet-panel w-full rounded-t-[24px] border-t border-white/10 bg-[#101010]/95 p-3 pb-5 text-white shadow-[0_-20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl" onclick={(event) => event.stopPropagation()}>
						<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25"></div>

						{#if sheet === 'share' || sheet === 'repost'}
							<h3 class="mb-2 px-2 text-[13px] font-bold">{sheet === 'repost' ? 'Репост и сохранение' : 'Поделиться видео'}</h3>
							{#if sheet === 'repost'}
								<button class="sheet-item" class:active={reposted} onclick={toggleRepost}><Icon name="repost" size={20} /> <span>{reposted ? 'Убрать репост' : 'Сохранить репост'}</span>{#if reposted}<Icon name="check" size={16} class="ml-auto" />{/if}</button>
								<button class="sheet-item" onclick={() => (sheet = 'share')}><Icon name="share" size={20} /> <span>Поделиться</span><Icon name="chevronRight" size={16} class="ml-auto" /></button>
							{/if}
							<button class="sheet-item" onclick={copyLink}><Icon name="link" size={20} /> <span>Копировать ссылку</span></button>
							<button class="sheet-item" onclick={downloadVideo}><Icon name="download" size={20} /> <span>Скачать видео</span></button>
							<button class="sheet-item" onclick={toggleSaved}><Icon name={saved ? 'check' : 'save'} size={20} /> <span>{saved ? 'Удалить из сохранённого' : 'Сохранить видео'}</span></button>
							<a class="sheet-item" href="/watch/{current.id}" onclick={() => (sheet = null)}><Icon name="external" size={20} /> <span>Открыть видео</span></a>
						{:else}
							<button class="sheet-item" onclick={copyLink}><Icon name="link" size={20} /> <span>Копировать ссылку на звук</span></button>
							<button class="sheet-item" onclick={downloadVideo}><Icon name="download" size={20} /> <span>Скачать аудио</span></button>
							<button class="sheet-item" onclick={toggleSaved}><Icon name={saved ? 'check' : 'save'} size={20} /> <span>{saved ? 'Удалить из сохранённого' : 'Сохранить звук'}</span></button>
							<button class="sheet-item" onclick={() => (sheet = 'share')}><Icon name="share" size={20} /> <span>Поделиться</span><Icon name="chevronRight" size={16} class="ml-auto" /></button>
							<a class="sheet-item" href="/watch/{current.id}" onclick={() => (sheet = null)}><Icon name="external" size={20} /> <span>Открыть видео</span></a>
						{/if}

						<button class="mt-2 w-full rounded-[12px] bg-white/10 py-2.5 text-[12px] font-bold text-white/80 transition hover:bg-white/15" onclick={() => (sheet = null)}>Отмена</button>
					</div>
				</div>
			{/if}
		</div>

		<div class="mb-8 flex shrink-0 flex-col items-center gap-5 self-end">
			<button class="short-action" class:liked onclick={toggleLike} aria-label="Нравится" aria-pressed={liked}>
				<span class="action-icon like-wrap" class:pop={likeBurst}>
					<Icon name="heart" size={23} filled={liked} strokeWidth={2.5} />
					{#if likeBurst}<span class="like-ring"></span>{/if}
				</span>
				<span class="action-count text-[11px] font-semibold">{formatCompact(likeCount)}</span>
			</button>
			<button class="short-action" onclick={openComments} aria-label="Комментарии">
				<span class="action-icon"><Icon name="comment" size={23} strokeWidth={2.5} /></span>
				<span class="action-count text-[11px] font-semibold">{formatCompact(current.commentCount)}</span>
			</button>
			<button class="short-action" onclick={() => openSheet('share')} aria-label="Поделиться">
				<span class="action-icon"><Icon name="share" size={23} strokeWidth={2.5} /></span>
				<span class="action-count text-[11px] font-semibold">Поделиться</span>
			</button>
			<button class="short-action" class:active={reposted} onclick={() => openSheet('repost')} aria-label="Репост" aria-pressed={reposted}>
				<span class="action-icon"><Icon name="repost" size={23} strokeWidth={2.5} /></span>
				<span class="action-count text-[11px] font-semibold">Репост</span>
			</button>
			<button class="short-action" onclick={() => openSheet('sound')} aria-label="Звук">
				<span class="action-icon sound-disc" style={current.thumbnail ? `background-image:url('${current.thumbnail}')` : ''}>
					<span class="sound-note"><Icon name="music" size={15} strokeWidth={2.6} /></span>
				</span>
				<span class="action-count text-[11px] font-semibold">Звук</span>
			</button>
		</div>

		{#if commentsOpen}
			<aside class="comments-panel flex h-[calc(100dvh-5.5rem)] max-h-[940px] w-[340px] shrink-0 flex-col rounded-[20px] bg-(--bg-elevated) p-4" transition:fly={{ x: 30, duration: 200 }}>
				<div class="mb-3 flex items-center justify-between">
					<h2 class="font-display text-[15px] font-extrabold">Комментарии</h2>
					<button class="icon-btn !h-8 !w-8" onclick={() => (commentsOpen = false)} aria-label="Закрыть"><Icon name="x" size={17} /></button>
				</div>

				<div class="flex-1 space-y-5 overflow-y-auto pr-1 no-scrollbar">
					{#each comments as comment (comment.id)}
						<div class="flex gap-3">
							<a href="/channel/{comment.user.id}" class="mt-0.5 shrink-0"><Avatar name={comment.user.name} image={comment.user.image} id={comment.user.id} size={36} /></a>
							<div class="min-w-0 flex-1">
								<div class="flex items-start gap-2">
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
											<a href="/channel/{comment.user.id}" class="text-[13px] font-bold hover:text-(--text)">@{comment.user.name.toLowerCase().replace(/\s+/g, '')}</a>
											{#if comment.user.verified}<VerifiedBadge size={12} />{/if}
											{#if comment.user.creator}<span class="rounded-[5px] bg-(--bg-subtle) px-1 text-[9px] font-bold">Создатель</span>{/if}
											{#if comment.user.id === current.user.id}<span class="rounded-[5px] bg-(--text) px-1.5 py-0.5 text-[9px] font-bold text-(--bg)">Автор</span>{/if}
											{#if comment.pinned}<span class="rounded-[5px] bg-(--bg-subtle) px-1 text-[9px] font-bold">Закреплён</span>{/if}
											<span class="text-[11px] text-(--text-tertiary)">{timeAgo(comment.createdAt)}</span>
										</div>
										<p class="mt-1.5 text-[13px] leading-relaxed whitespace-pre-wrap">{comment.content}</p>
									</div>
									<CommentMenu commentId={comment.id} authorId={comment.user.id} ownerId={current.user.id} currentUserId={user?.id} pinned={comment.pinned} onupdate={loadComments} />
								</div>

								<div class="mt-2 flex items-center gap-1">
									<button class="comment-action" class:active={likedComments[comment.id]} onclick={() => likeComment(comment)}>
										<Icon name="thumbUp" size={15} filled={!!likedComments[comment.id]} />
										{#if comment.likeCount > 0}<span class="tabular-nums">{formatCompact(comment.likeCount)}</span>{/if}
									</button>
									<button class="comment-action" class:active={dislikedComments[comment.id]} onclick={() => dislikeComment(comment.id)} aria-label="Не нравится">
										<Icon name="thumbDown" size={15} filled={!!dislikedComments[comment.id]} />
									</button>
									{#if user}
										<button class="comment-action" onclick={() => (replyTo = replyTo === comment.id ? null : comment.id)}>Ответить</button>
									{/if}
								</div>

								{#if replyTo === comment.id}
									<form class="mt-2 flex gap-2" onsubmit={(event) => { event.preventDefault(); postComment(comment.id); }}>
										<input bind:value={replyText} class="field h-9 min-w-0 flex-1 px-3 text-[12px]" placeholder="Ответить..." />
										<button type="submit" class="btn-primary !h-9 !px-3 !rounded-[10px] text-[12px]">Ответить</button>
									</form>
								{/if}

								{#if (comment.replies ?? []).length > 0}
									<button class="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)" onclick={() => toggleReplies(comment.id)}>
										<Icon name={expandedReplies.includes(comment.id) ? 'chevronUp' : 'chevronDown'} size={15} />
										{(comment.replies ?? []).length} ответов
									</button>
									{#if expandedReplies.includes(comment.id)}
										<div class="mt-3 flex flex-col gap-3 border-l-2 border-(--border) pl-3">
											{#each comment.replies ?? [] as reply (reply.id)}
												<div class="flex gap-2.5">
													<Avatar name={reply.user.name} image={reply.user.image} id={reply.user.id} size={28} />
													<div class="min-w-0 flex-1">
														<div class="flex flex-wrap items-center gap-x-1.5">
															<a href="/channel/{reply.user.id}" class="text-[12px] font-bold">@{reply.user.name.toLowerCase().replace(/\s+/g, '')}</a>
															<span class="text-[10px] text-(--text-tertiary)">{timeAgo(reply.createdAt)}</span>
														</div>
														<p class="mt-1 text-[12px] leading-relaxed whitespace-pre-wrap">{reply.content}</p>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								{/if}
							</div>
						</div>
					{:else}
						<p class="py-8 text-center text-[12px] text-(--text-tertiary)">Комментариев пока нет</p>
					{/each}
				</div>

				{#if user}
					<form class="mt-3 flex gap-2 border-t border-(--border) pt-3" onsubmit={(event) => { event.preventDefault(); postComment(); }}>
						<input bind:value={commentText} class="field h-10 min-w-0 flex-1 px-3" placeholder="Добавить комментарий" />
						<button type="submit" class="icon-btn !h-10 !w-10" aria-label="Отправить"><Icon name="send" size={18} /></button>
					</form>
				{:else}
					<a href="/login" class="btn-secondary mt-3 h-10 w-full text-[12px]">Войдите, чтобы комментировать</a>
				{/if}
			</aside>
		{/if}

		<button
			class="fixed right-4 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-(--bg-elevated) text-(--text-secondary) shadow-lg transition hover:scale-110 hover:text-(--text) disabled:opacity-30"
			onclick={next}
			disabled={index >= visibleShorts.length - 1}
			aria-label="Следующий Shorts"
		>
			<Icon name="chevronDown" size={22} strokeWidth={2.6} />
		</button>
	</div>
{:else}
	<div class="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4">
		<EmptyState icon="video" title="Shorts пока нет" description="Загрузите вертикальное видео — оно появится здесь." />
	</div>
{/if}

<style>
	.short-frame {
		aspect-ratio: 9 / 16;
		height: auto;
		width: min(100%, calc((100dvh - 5.5rem) * 9 / 16));
		max-height: calc(100dvh - 5.5rem);
		border-radius: 20px;
		box-shadow: 0 30px 90px -30px rgb(0 0 0 / 0.95), 0 0 0 1px rgb(255 255 255 / 0.04);
	}
	.top-glass {
		display: inline-flex;
		height: 30px;
		width: 30px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: transparent;
		color: rgb(255 255 255 / 0.9);
		text-shadow: 0 1px 6px rgb(0 0 0 / 0.9);
		transition: transform 0.18s ease, color 0.18s ease;
	}
	.top-glass:hover { transform: scale(1.1); color: #fff; }
	.top-glass.active { color: #fff; }
	.volume-track {
		position: relative;
		width: 104px;
		height: 22px;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
	}
	.volume-track::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		height: 5px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.3);
	}
	.volume-fill {
		position: absolute;
		left: 0;
		height: 5px;
		border-radius: 999px;
		background: linear-gradient(90deg, rgb(255 255 255 / 0.75), #fff);
		box-shadow: 0 0 12px rgb(255 255 255 / 0.4);
		pointer-events: none;
	}
	.volume-thumb {
		position: absolute;
		height: 15px;
		width: 15px;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 1px 8px rgb(0 0 0 / 0.9);
		transform: translateX(-50%);
		pointer-events: none;
		transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
	}
	.volume-thumb.dragging { transform: translateX(-50%) scale(1.35); box-shadow: 0 2px 14px rgb(0 0 0 / 0.9), 0 0 0 6px rgb(255 255 255 / 0.14); }
	.short-menu { font-size: 12px; }
	.short-menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 11px;
		border-radius: 10px;
		padding: 9px 10px;
		text-align: left;
		transition: background-color 0.16s ease;
	}
	.short-menu-item:hover { background: rgb(255 255 255 / 0.1); }
	.short-menu-item span:not(.menu-value) { flex: 1; }
	.menu-value { font-size: 11px; color: rgb(255 255 255 / 0.5); }
	.bottom-subscribe {
		display: inline-flex;
		height: 26px;
		align-items: center;
		gap: 4px;
		border-radius: 999px;
		background: #ededed;
		padding: 0 10px;
		font-size: 10px;
		font-weight: 800;
		color: #050505;
		box-shadow: 0 6px 16px -8px rgb(0 0 0 / 0.9);
		transition: transform 0.18s ease, background-color 0.18s ease;
	}
	.bottom-subscribe:hover { transform: scale(1.04); background: #fff; }
	.bottom-subscribe.subscribed { background: rgb(255 255 255 / 0.16); color: #fff; }
	.short-action {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		color: var(--text);
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.short-action > :first-child,
	.action-icon {
		position: relative;
		display: inline-flex;
		height: 48px;
		width: 48px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: rgb(18 18 18 / 0.55);
		box-shadow: 0 8px 22px -10px rgb(0 0 0 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.06);
		transition: background-color 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
	}
	.short-action:hover { transform: translateY(-2px) scale(1.06); }
	.short-action:hover > :first-child,
	.short-action:hover .action-icon { background: rgb(255 255 255 / 0.14); box-shadow: 0 10px 26px -10px rgb(0 0 0 / 0.95), 0 0 20px -12px rgb(255 255 255 / 0.5); }
	.short-action.liked .action-icon { color: #fff; background: rgb(255 255 255 / 0.16); }
	.short-action.active .action-icon { background: #ededed; color: #050505; }
	.action-count { text-shadow: 0 1px 6px rgb(0 0 0 / 0.9); }
	.sound-disc {
		background-color: #222;
		background-size: cover;
		background-position: center;
		animation: disc-spin 5s linear infinite;
	}
	.sound-note {
		display: inline-flex;
		height: 22px;
		width: 22px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.65);
		color: #fff;
	}
	@keyframes disc-spin { to { transform: rotate(360deg); } }
	.like-wrap.pop { animation: like-pop 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
	.like-ring {
		position: absolute;
		inset: -6px;
		border-radius: 999px;
		border: 2px solid rgb(255 255 255 / 0.8);
		animation: like-ring 0.6s ease-out forwards;
		pointer-events: none;
	}
	@keyframes like-pop {
		0% { transform: scale(1); }
		30% { transform: scale(1.45) rotate(-8deg); }
		55% { transform: scale(0.85) rotate(4deg); }
		100% { transform: scale(1); }
	}
	@keyframes like-ring {
		0% { opacity: 0.9; transform: scale(0.5); }
		100% { opacity: 0; transform: scale(1.8); }
	}
	.sheet-backdrop { background: rgb(0 0 0 / 0.45); }
	.sheet-panel { max-height: 78%; overflow-y: auto; }
	.sheet-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 12px;
		border-radius: 13px;
		padding: 13px 14px;
		font-size: 13px;
		font-weight: 600;
		text-align: left;
		transition: background-color 0.16s ease;
	}
	.sheet-item:hover { background: rgb(255 255 255 / 0.09); }
	.sheet-item.active { background: rgb(255 255 255 / 0.12); color: #fff; }
	.comment-action {
		display: inline-flex;
		height: 30px;
		align-items: center;
		gap: 5px;
		border-radius: 999px;
		padding: 0 9px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-tertiary);
		transition: background-color 0.16s ease, color 0.16s ease;
	}
	.comment-action:hover { background: rgb(255 255 255 / 0.07); color: var(--text); }
	.comment-action.active { color: var(--text); }
	@media (max-width: 640px) {
		.short-action > :first-child, .action-icon { height: 40px; width: 40px; }
		.short-action { gap: 2px; }
		.short-action span { font-size: 10px; }
	}
</style>
