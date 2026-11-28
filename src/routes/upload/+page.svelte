<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { toasts } from '#lib/stores/toast.svelte';
	import { UPLOAD_CATEGORIES } from '#lib/constants';
	import { formatDuration } from '#lib/utils/format';
	import { findLinks } from '#lib/utils/links';
	import { qualityLabel } from '#lib/utils/videoQuality';
	import Icon from '#lib/components/Icon.svelte';
	import UploadPlayer from '#lib/components/UploadPlayer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let videoFile = $state<File | null>(null);
	let thumbFile = $state<File | null>(null);
	let videoObjectUrl = $state<string | null>(null);
	let thumbObjectUrl = $state<string | null>(null);
	let duration = $state(0);
	let resolution = $state('');
	let quality = $state('');
	let orientation = $state<'vertical' | 'horizontal'>('horizontal');
	let processing = $state('');
	let title = $state('');
	let description = $state('');
	let category = $state('Другое');
	let visibility = $state<'public' | 'unlisted' | 'private'>('public');
	let tags = $state('');
	let dragActive = $state(false);
	let uploading = $state(false);
	let progress = $state(0);
	let error = $state('');
	let thumbManual = $state(false);
	let thumbToken = 0;

	const descriptionHashtags = $derived((description.match(/#[\p{L}\p{N}_]{2,30}/gu) ?? []).map((tag) => tag.slice(1)));
	const tagList = $derived(
		[...tags.split(',').map((tag) => tag.trim()).filter(Boolean), ...descriptionHashtags].slice(0, 12)
	);
	const foundLinks = $derived([title, description, tags].flatMap(findLinks));
	const linksLocked = $derived(!data.isCreator && data.subscriberCount < data.linksMinSubscribers);
	const linksProblem = $derived(linksLocked && foundLinks.length > 0);
	const canPublish = $derived(Boolean(videoFile) && Boolean(title.trim()) && !linksProblem);

	let titleInput = $state<HTMLInputElement>();
	let descriptionInput = $state<HTMLTextAreaElement>();
	let hashtagField = $state<'title' | 'description' | null>(null);
	let hashtagQuery = $state<string | null>(null);
	let hashtagSuggestions = $state<{ tag: string; count: number }[]>([]);
	let hashtagTimer: ReturnType<typeof setTimeout> | undefined;

	let videoInput = $state<HTMLInputElement>();
	let thumbInput = $state<HTMLInputElement>();
	let xhr: XMLHttpRequest | null = null;

	const MAX_SIZE = 1024 * 1024 * 1024;

	const visibilityOptions = [
		{ value: 'public', label: 'Открытое', hint: 'Видно всем в ленте и поиске', icon: 'globe' },
		{ value: 'unlisted', label: 'По ссылке', hint: 'Только у кого есть ссылка', icon: 'link' },
		{ value: 'private', label: 'Закрытое', hint: 'Видно только вам', icon: 'lock' }
	] as const;

	function fileSize(bytes: number) {
		if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
		if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
		return `${Math.round(bytes / 1024)} КБ`;
	}

	function syncHashtag(field: 'title' | 'description', event: Event) {
		const element = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
		const value = element.value;
		const caret = element.selectionStart ?? value.length;
		const match = value.slice(0, caret).match(/(?:^|[\s(])#([\p{L}\p{N}_]{1,30})$/u);
		hashtagField = match ? field : null;
		hashtagQuery = match ? match[1] : null;
		clearTimeout(hashtagTimer);
		if (!hashtagQuery) {
			hashtagSuggestions = [];
			return;
		}
		const query = hashtagQuery;
		hashtagTimer = setTimeout(async () => {
			try {
				const response = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
				if (response.ok && hashtagQuery === query) {
					hashtagSuggestions = (await response.json()).tags ?? [];
				}
			} catch {
				hashtagSuggestions = [];
			}
		}, 180);
	}

	async function insertHashtag(tag: string) {
		const field = hashtagField;
		if (!field || !hashtagQuery) return;
		const element = field === 'title' ? titleInput : descriptionInput;
		const value = field === 'title' ? title : description;
		const caret = element?.selectionStart ?? value.length;
		const match = value.slice(0, caret).match(/(?:^|[\s(])#([\p{L}\p{N}_]{1,30})$/u);
		if (!match) return;

		const start = caret - match[1].length - 1;
		const next = value.slice(0, start) + `#${tag} ` + value.slice(caret);
		const position = start + tag.length + 2;
		if (field === 'title') title = next.slice(0, 120);
		else description = next.slice(0, 5000);

		hashtagField = null;
		hashtagQuery = null;
		hashtagSuggestions = [];
		await tick();
		element?.focus();
		element?.setSelectionRange(position, position);
	}

	async function extractThumbnail(url: string): Promise<File | null> {
		return new Promise((resolve) => {
			const probe = document.createElement('video');
			probe.preload = 'auto';
			probe.muted = true;
			probe.playsInline = true;
			probe.src = url;

			const fail = () => resolve(null);

			probe.onloadeddata = () => {
				try {
					probe.currentTime = Math.min(1.2, Math.max(0.1, probe.duration * 0.1));
				} catch {
					fail();
				}
			};

			probe.onseeked = () => {
				try {
					const maxWidth = 1280;
					const scale = Math.min(1, maxWidth / probe.videoWidth);
					const canvas = document.createElement('canvas');
					canvas.width = Math.round(probe.videoWidth * scale);
					canvas.height = Math.round(probe.videoHeight * scale);
					const context = canvas.getContext('2d');
					if (!context) return fail();
					context.drawImage(probe, 0, 0, canvas.width, canvas.height);
					canvas.toBlob(
						(blob) => {
							if (!blob) return resolve(null);
							resolve(new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }));
						},
						'image/jpeg',
						0.86
					);
				} catch {
					fail();
				}
			};

			probe.onerror = fail;
			setTimeout(fail, 8000);
		});
	}

	async function handleVideo(file: File | undefined) {
		error = '';
		if (!file) return;
		if (!file.type.startsWith('video/')) {
			error = 'Выберите видеофайл (MP4, WebM или MOV).';
			return;
		}
		if (file.size > MAX_SIZE) {
			error = 'Видео больше 1 ГБ. Сожмите файл и попробуйте снова.';
			return;
		}

		if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
		if (thumbObjectUrl) URL.revokeObjectURL(thumbObjectUrl);

		const token = ++thumbToken;
		videoFile = file;
		videoObjectUrl = URL.createObjectURL(file);
		thumbFile = null;
		thumbObjectUrl = null;
		thumbManual = false;

		if (!title) title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120);

		const probe = document.createElement('video');
		probe.preload = 'metadata';
		probe.src = videoObjectUrl;
		probe.onloadedmetadata = () => {
			duration = Number.isFinite(probe.duration) ? probe.duration : 0;
			if (probe.videoWidth && probe.videoHeight) {
				resolution = `${probe.videoWidth}×${probe.videoHeight}`;
				quality = qualityLabel(probe.videoWidth, probe.videoHeight);
				orientation = probe.videoHeight > probe.videoWidth ? 'vertical' : 'horizontal';
			}
		};

		const generated = await extractThumbnail(videoObjectUrl);
		if (token !== thumbToken || !videoFile) return;
		if (generated) {
			thumbFile = generated;
			thumbObjectUrl = URL.createObjectURL(generated);
		}
	}

	function onVideoChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		handleVideo(input.files?.[0]);
	}

	function onThumbChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			error = 'Обложка должна быть изображением.';
			return;
		}
		if (file.size > 8 * 1024 * 1024) {
			error = 'Обложка больше 8 МБ.';
			return;
		}
		if (thumbObjectUrl) URL.revokeObjectURL(thumbObjectUrl);
		thumbToken++;
		thumbFile = file;
		thumbObjectUrl = URL.createObjectURL(file);
		thumbManual = true;
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragActive = false;
		handleVideo(event.dataTransfer?.files?.[0]);
	}

	function resetVideo() {
		thumbToken++;
		thumbManual = false;
		if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
		if (thumbObjectUrl) URL.revokeObjectURL(thumbObjectUrl);
		videoFile = null;
		thumbFile = null;
		videoObjectUrl = null;
		thumbObjectUrl = null;
		duration = 0;
		resolution = '';
		quality = '';
		orientation = 'horizontal';
		if (videoInput) videoInput.value = '';
	}

	function submit() {
		error = '';
		if (!videoFile) {
			error = 'Сначала выберите видеофайл.';
			return;
		}
		if (!title.trim()) {
			error = 'Добавьте название видео.';
			return;
		}
		if (linksProblem) {
			error = `Ссылки доступны каналам от ${data.linksMinSubscribers} подписчиков. Уберите их из текста.`;
			return;
		}

		const formData = new FormData();
		formData.append('video', videoFile);
		if (thumbFile) formData.append('thumbnail', thumbFile);
		formData.append('title', title.trim());
		formData.append('description', description.trim());
		formData.append('category', category);
		formData.append('visibility', visibility);
		formData.append('duration', String(Math.round(duration)));
		formData.append('orientation', orientation);
		formData.append(
			'tags',
			JSON.stringify(
				tags
					.split(',')
					.map((tag) => tag.trim())
					.filter(Boolean)
			)
		);

		uploading = true;
		progress = 0;

		const request = new XMLHttpRequest();
		xhr = request;
		request.open('POST', '/api/videos');

		request.upload.onprogress = (event) => {
			if (event.lengthComputable) progress = Math.round((event.loaded / event.total) * 100);
		};

		request.onload = () => {
			uploading = false;
			xhr = null;
			if (request.status >= 200 && request.status < 300) {
				try {
					const result = JSON.parse(request.responseText) as { id: string; copyrightClaim?: boolean };
					const claimed = result.copyrightClaim;
					processing = 'Обрабатываем видео и создаём предпросмотр…';
					setTimeout(() => {
						processing = '';
						if (claimed) toasts.error('Видео заблокировано: совпадение с защищённым контентом');
						else toasts.success('Видео опубликовано');
						goto(`/watch/${result.id}`);
					}, 1200);
				} catch {
					error = 'Видео загружено, но ответ сервера не распознан.';
				}
			} else {
				try {
					const result = JSON.parse(request.responseText) as { message?: string };
					error = result.message || 'Не удалось загрузить видео.';
				} catch {
					error = 'Не удалось загрузить видео.';
				}
			}
		};

		request.onerror = () => {
			uploading = false;
			xhr = null;
			error = 'Сеть недоступна. Попробуйте ещё раз.';
		};

		request.onabort = () => {
			uploading = false;
			xhr = null;
			progress = 0;
		};

		request.send(formData);
	}

	function cancelUpload() {
		xhr?.abort();
	}
</script>

<svelte:head>
	<title>Загрузка видео — VueTube</title>
</svelte:head>

<div class="mx-auto max-w-[1240px] px-4 pt-8 pb-20 sm:px-6">
	<div class="fade-in mb-7 flex flex-wrap items-end justify-between gap-5">
		<div class="min-w-0">
			<div class="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-(--text-tertiary) uppercase">
				<Icon name="sparkles" size={13} class="text-(--accent)" />
				Студия · новая публикация
			</div>
			<h1 class="font-display text-[30px] leading-tight font-extrabold tracking-[-0.04em] sm:text-[38px]">Загрузить видео</h1>
			<p class="mt-2 max-w-xl text-[13px] leading-relaxed text-(--text-secondary) sm:text-sm">
				Добавьте файл, расскажите о нём и выберите, кто сможет его увидеть.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<div class="hidden items-center gap-1.5 rounded-full border border-(--border) bg-(--bg-elevated) p-1.5 lg:flex">
				<span class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold {videoFile ? 'bg-emerald-500/10 text-emerald-400' : 'bg-(--bg-subtle) text-(--text-secondary)'}">
					{#if videoFile}<Icon name="check" size={12} />{:else}<span class="grid h-4 w-4 place-items-center rounded-full bg-(--border-strong) text-[9px]">1</span>{/if}
					Файл
				</span>
				<span class="h-px w-3 bg-(--border-strong)"></span>
				<span class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold {title.trim() ? 'bg-emerald-500/10 text-emerald-400' : 'bg-(--bg-subtle) text-(--text-secondary)'}">
					{#if title.trim()}<Icon name="check" size={12} />{:else}<span class="grid h-4 w-4 place-items-center rounded-full bg-(--border-strong) text-[9px]">2</span>{/if}
					Описание
				</span>
				<span class="h-px w-3 bg-(--border-strong)"></span>
				<span class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold {canPublish ? 'bg-(--accent-soft) text-(--accent)' : 'bg-(--bg-subtle) text-(--text-tertiary)'}">
					<span class="grid h-4 w-4 place-items-center rounded-full border border-current text-[9px] opacity-70">3</span>
					Публикация
				</span>
			</div>
			<a href="/" class="btn-secondary h-9 px-4 text-[13px]">
				<Icon name="arrowLeft" size={16} />
				На главную
			</a>
		</div>
	</div>

	{#if error}
		<div class="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3.5 text-[13px] text-red-500">
			<Icon name="info" size={18} class="mt-0.5 shrink-0" />
			<p class="flex-1 leading-relaxed">{error}</p>
			<button type="button" class="shrink-0 rounded-lg p-1 transition hover:bg-red-500/10" aria-label="Закрыть ошибку" onclick={() => (error = '')}>
				<Icon name="x" size={15} />
			</button>
		</div>
	{/if}

	<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
		<div class="space-y-6">
			<section>
				<div class="mb-3.5 flex items-center gap-3">
					<span class="flex h-9 w-9 items-center justify-center rounded-[12px] border border-(--border) bg-(--bg-elevated) text-(--accent)">
						<Icon name="film" size={18} />
					</span>
					<div class="min-w-0">
						<h2 class="font-display text-[16px] font-bold">Видеофайл</h2>
						<p class="text-[11px] text-(--text-tertiary)">Шаг 1 · выберите, что публикуем</p>
					</div>
					{#if videoFile}
						<span class="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
							<Icon name="check" size={12} /> Добавлен
						</span>
					{/if}
				</div>

			{#if !videoFile}
				<button
					type="button"
					class="dropzone group relative flex min-h-[360px] w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed px-6 py-12 text-center transition-all duration-300 {dragActive
						? 'border-(--accent) bg-(--accent-soft)'
						: 'border-(--border-strong) bg-(--bg-subtle) hover:border-(--accent) hover:bg-(--bg-hover)'}"
					onclick={() => videoInput?.click()}
					ondragover={(event) => {
						event.preventDefault();
						dragActive = true;
					}}
					ondragleave={() => (dragActive = false)}
					ondrop={onDrop}
				>
					<span class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style="background:radial-gradient(circle at 50% 110%, var(--accent-soft), transparent 65%)"></span>
					<span class="relative flex flex-col items-center gap-5">
						<span class="flex h-20 w-20 items-center justify-center rounded-[22px] border border-(--border) bg-(--bg-elevated) text-(--accent) shadow-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105">
							<Icon name="upload" size={34} />
						</span>
						<span class="block">
							<span class="font-display block text-xl font-extrabold tracking-[-0.02em] sm:text-[22px]">
								{dragActive ? 'Отпустите, чтобы добавить' : 'Перетащите видео сюда'}
							</span>
							<span class="mt-2 block text-[13px] text-(--text-secondary)">или нажмите кнопку ниже</span>
						</span>
						<span class="btn-secondary pointer-events-none h-10 px-5 text-[13px] shadow-lg transition group-hover:border-(--accent) group-hover:text-(--accent)">
							<Icon name="folder" size={16} />
							Выбрать файл
						</span>
						<span class="flex flex-wrap items-center justify-center gap-2">
							{#each ['MP4', 'WebM', 'MOV'] as format}
								<span class="rounded-[8px] border border-(--border) bg-(--bg-elevated) px-2 py-1 text-[10px] font-bold tracking-wide text-(--text-tertiary)">{format}</span>
							{/each}
							<span class="text-[11px] text-(--text-tertiary)">до 1 ГБ</span>
						</span>
					</span>
				</button>
				<input bind:this={videoInput} type="file" accept="video/*" class="hidden" onchange={onVideoChange} />
			{:else}
				<div class="overflow-hidden rounded-[24px] border border-(--border) bg-(--bg-elevated)">
					<div class="flex items-center gap-3 border-b border-(--border) px-4 py-3">
						<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-(--accent-soft) text-(--accent)">
							<Icon name="film" size={18} />
						</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-[13px] font-semibold">{videoFile.name}</p>
							<p class="text-[11px] text-(--text-secondary)">Файл готов к публикации</p>
						</div>
						<span class="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 sm:inline-flex">
							<Icon name="check" size={11} /> Готово
						</span>
					</div>
					<UploadPlayer src={videoObjectUrl ?? ''} vertical={orientation === 'vertical'} />
					<div class="flex flex-wrap gap-2 px-4 py-3.5">
						{#if duration}
							<span class="inline-flex items-center gap-1.5 rounded-[9px] bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-semibold text-(--text-secondary)"><Icon name="clock" size={12} />{formatDuration(duration)}</span>
						{/if}
						{#if fileSize(videoFile.size)}
							<span class="inline-flex items-center gap-1.5 rounded-[9px] bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-semibold text-(--text-secondary)"><Icon name="save" size={12} />{fileSize(videoFile.size)}</span>
						{/if}
						{#if resolution}
							<span class="inline-flex items-center gap-1.5 rounded-[9px] bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-semibold text-(--text-secondary)"><Icon name="monitor" size={12} />{resolution}</span>
						{/if}
						{#if quality}
							<span class="inline-flex items-center gap-1.5 rounded-[9px] bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-semibold text-(--text-secondary)"><Icon name="sparkles" size={12} />{quality}</span>
						{/if}
						<span class="inline-flex items-center gap-1.5 rounded-[9px] bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-semibold text-(--text-secondary)">
							<Icon name={orientation === 'vertical' ? 'film' : 'theater'} size={12} />
							{orientation === 'vertical' ? 'Shorts' : 'Видео'}
						</span>
					</div>
					<div class="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) px-4 py-3">
						<p class="max-w-md text-[11px] leading-snug text-(--text-tertiary)">
							Качество берётся из исходного файла. Уменьшенные копии — для медленного интернета. Неподдерживаемые форматы конвертируются автоматически.
						</p>
						<div class="flex gap-2">
							<button class="btn-secondary h-9 px-3 text-[12px]" onclick={() => videoInput?.click()}>
								<Icon name="edit" size={14} /> Заменить
							</button>
							<button class="btn-secondary h-9 px-3 text-[12px] hover:text-red-400" onclick={resetVideo}>
								<Icon name="trash" size={14} /> Убрать
							</button>
						</div>
					</div>
				</div>
				<input bind:this={videoInput} type="file" accept="video/*" class="hidden" onchange={onVideoChange} />
			{/if}
			</section>

			<section>
				<div class="mb-3.5 flex items-center gap-3">
					<span class="flex h-9 w-9 items-center justify-center rounded-[12px] border border-(--border) bg-(--bg-elevated) text-(--accent)">
						<Icon name="edit" size={18} />
					</span>
					<div class="min-w-0">
						<h2 class="font-display text-[16px] font-bold">Описание</h2>
						<p class="text-[11px] text-(--text-tertiary)">Шаг 2 · помогите зрителям найти видео</p>
					</div>
					{#if title.trim()}
						<span class="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
							<Icon name="check" size={12} /> Заполнено
						</span>
					{/if}
				</div>

				{#snippet hashtagPanel(field: 'title' | 'description')}
					{#if hashtagQuery && hashtagField === field}
						<div class="menu-panel top-full left-0 z-30 mt-1.5 w-full max-w-[420px] p-1.5">
							<div class="px-2 py-1 text-[10px] font-bold tracking-wider text-(--text-tertiary) uppercase">
								Хештег · популярность
							</div>
							{#each hashtagSuggestions as suggestion (suggestion.tag)}
								<button type="button" class="menu-item" onclick={() => insertHashtag(suggestion.tag)}>
									<span class="font-semibold text-sky-400">#{suggestion.tag}</span>
									<span class="ml-auto text-[11px] text-(--text-tertiary)">{suggestion.count} видео</span>
								</button>
							{/each}
							<button type="button" class="menu-item" onclick={() => insertHashtag(hashtagQuery!)}>
								<Icon name="plus" size={13} />
								Создать #{hashtagQuery}
							</button>
						</div>
					{/if}
				{/snippet}

				<div class="space-y-5 rounded-[24px] border border-(--border) bg-(--bg-elevated) p-5 sm:p-6">
					<label class="relative block">
						<span class="mb-2 flex items-center justify-between text-[13px] font-semibold">
							Название <span class="text-(--accent)">*</span>
							<span class="text-[11px] font-normal tabular-nums {title.length > 100 ? 'text-(--accent)' : 'text-(--text-tertiary)'}">{title.length}/120</span>
						</span>
						<input
							bind:this={titleInput}
							bind:value={title}
							maxlength="120"
							placeholder="О чём это видео? Используйте #хештеги"
							class="field h-12 w-full rounded-[13px] px-4"
							oninput={(event) => syncHashtag('title', event)}
							onclick={(event) => syncHashtag('title', event)}
							onkeyup={(event) => syncHashtag('title', event)}
						/>
						{@render hashtagPanel('title')}
					</label>

					<label class="relative block">
						<span class="mb-2 flex items-center justify-between text-[13px] font-semibold">
							Описание
							<span class="text-[11px] font-normal tabular-nums text-(--text-tertiary)">{description.length}/5000</span>
						</span>
						<textarea
							bind:this={descriptionInput}
							bind:value={description}
							maxlength="5000"
							rows="6"
							placeholder="Расскажите зрителям о видео. Добавьте #хештеги для рекомендаций…"
							class="field h-auto w-full resize-y rounded-[13px] px-4 py-3 leading-relaxed"
							oninput={(event) => syncHashtag('description', event)}
							onclick={(event) => syncHashtag('description', event)}
							onkeyup={(event) => syncHashtag('description', event)}
						></textarea>
						{@render hashtagPanel('description')}
						<span class="mt-1.5 block text-[11px] leading-relaxed text-(--text-tertiary)">
							Хештеги (#…) попадают в теги и повышают рекомендации.
							{#if linksLocked}
								Ссылки и контакты доступны каналам от {data.linksMinSubscribers} подписчиков (у вас {data.subscriberCount}).
							{:else}
								Ссылки разрешены{data.isCreator ? ' — у вас статус создателя' : ` — у вас уже ${data.subscriberCount} подписчиков`}.
							{/if}
						</span>
						{#if linksProblem}
							<div class="mt-2.5 flex items-start gap-2 rounded-[12px] border border-red-500/25 bg-red-500/8 px-3 py-2 text-[11px] leading-relaxed text-red-500">
								<Icon name="link" size={14} class="mt-0.5 shrink-0" />
								<span>
									Ссылки запрещены: {foundLinks.slice(0, 3).join(', ')}{foundLinks.length > 3 ? '…' : ''}.
									Уберите их из названия, описания и тегов любым способом.
								</span>
							</div>
						{/if}
					</label>

					<div>
						<span class="mb-2 flex items-center justify-between text-[13px] font-semibold">
							Теги
							<span class="text-[11px] font-normal text-(--text-tertiary)">до 12 штук</span>
						</span>
						<input bind:value={tags} placeholder="svelte, дизайн, обучение" class="field h-12 w-full rounded-[13px] px-4" />
						{#if tagList.length}
							<div class="mt-3 flex flex-wrap gap-1.5">
								{#each tagList as tag}
									<span class="rounded-[9px] border border-(--border) bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-medium text-(--text-secondary)">#{tag}</span>
								{/each}
							</div>
						{:else}
							<span class="mt-2 block text-[11px] text-(--text-tertiary)">Перечислите теги через запятую или добавьте #хештеги в описание.</span>
						{/if}
					</div>
				</div>
			</section>
		</div>

		<aside class="space-y-4 lg:sticky lg:top-6">
			<div class="rounded-[24px] border border-(--border) bg-(--bg-elevated) p-4">
				<div class="mb-3 flex items-center justify-between">
					<span class="flex items-center gap-2 text-[13px] font-semibold">
						<Icon name="image" size={15} class="text-(--accent)" />
						Обложка
					</span>
					{#if thumbFile}
						<span class="rounded-full bg-(--bg-subtle) px-2 py-0.5 text-[10px] font-bold text-(--text-tertiary)">
							{thumbManual ? 'Своя' : 'Авто'}
						</span>
					{/if}
				</div>
				<button
					type="button"
					class="group relative block aspect-video w-full overflow-hidden rounded-[16px] border border-(--border) bg-(--bg-subtle)"
					onclick={() => thumbInput?.click()}
				>
					{#if thumbObjectUrl}
						<img src={thumbObjectUrl} alt="Обложка" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
					{:else}
						<span class="flex h-full w-full flex-col items-center justify-center gap-2 text-(--text-tertiary)">
							<span class="flex h-10 w-10 items-center justify-center rounded-[12px] bg-(--bg-elevated)"><Icon name="camera" size={20} /></span>
							<span class="text-[11px]">Кадр появится автоматически</span>
						</span>
					{/if}
					<span class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/65 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
						<Icon name="camera" size={22} class="text-white" />
						<span class="text-[11px] font-semibold text-white">Изменить обложку</span>
					</span>
				</button>
				<input bind:this={thumbInput} type="file" accept="image/*" class="hidden" onchange={onThumbChange} />
				<p class="mt-2.5 text-[11px] leading-relaxed text-(--text-tertiary)">
					Кадр из видео создаётся автоматически. Можно загрузить свою картинку до 8 МБ.
				</p>
			</div>

			<div class="rounded-[24px] border border-(--border) bg-(--bg-elevated) p-4">
				<label class="block">
					<span class="mb-2 block text-[13px] font-semibold">Категория</span>
					<span class="relative block">
						<select bind:value={category} class="field h-11 w-full appearance-none rounded-[13px] px-3.5 pr-10">
							{#each UPLOAD_CATEGORIES as option (option)}
								<option value={option}>{option}</option>
							{/each}
						</select>
						<Icon name="chevronDown" size={16} class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-(--text-tertiary)" />
					</span>
				</label>

				<div class="mt-5">
					<span class="mb-2 block text-[13px] font-semibold">Доступ</span>
					<div class="space-y-2">
						{#each visibilityOptions as option (option.value)}
							<label
								class="flex cursor-pointer items-start gap-2.5 rounded-[14px] border p-3 transition {visibility === option.value
									? 'border-(--accent) bg-(--accent-soft)'
									: 'border-(--border) hover:border-(--border-strong) hover:bg-(--bg-hover)'}"
							>
								<input type="radio" name="visibility" value={option.value} bind:group={visibility} class="sr-only" />
								<span class="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 {visibility === option.value ? 'border-(--accent) bg-(--accent) text-(--bg)' : 'border-(--border-strong)'}">
									{#if visibility === option.value}<Icon name="check" size={11} strokeWidth={3.2} />{/if}
								</span>
								<span class="min-w-0">
									<span class="flex items-center gap-1.5 text-[13px] font-semibold">
										<Icon name={option.icon} size={14} />
										{option.label}
									</span>
									<span class="mt-0.5 block text-[11px] leading-snug text-(--text-secondary)">{option.hint}</span>
								</span>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<div class="rounded-[24px] border border-(--border) bg-(--bg-elevated) p-4">
				{#if processing}
					<div class="flex flex-col items-center gap-3 py-3 text-center">
						<span class="flex h-12 w-12 animate-spin items-center justify-center rounded-full border-[3px] border-(--border-strong) border-t-(--accent)"></span>
						<span class="text-[13px] font-semibold">{processing}</span>
						<span class="text-[11px] text-(--text-tertiary)">Не закрывайте страницу</span>
					</div>
				{:else if uploading}
					<div class="mb-3 flex items-center justify-between">
						<span class="flex items-center gap-2 text-[13px] font-semibold"><Icon name="upload" size={15} class="text-(--accent)" /> Загрузка…</span>
						<span class="text-[13px] font-bold tabular-nums text-(--accent)">{progress}%</span>
					</div>
					<div class="h-2.5 overflow-hidden rounded-full bg-(--bg-hover)">
						<div class="progress-bar h-full rounded-full bg-(--accent)" style="width:{progress}%"></div>
					</div>
					<button class="btn-secondary mt-4 h-10 w-full text-[13px]" onclick={cancelUpload}>
						<Icon name="x" size={15} /> Отменить загрузку
					</button>
				{:else}
					<div class="mb-4 space-y-2">
						<div class="flex items-center gap-2 text-[11px] font-medium {videoFile ? 'text-emerald-400' : 'text-(--text-tertiary)'}">
							<Icon name={videoFile ? 'check' : 'clock'} size={13} />
							Видеофайл {videoFile ? 'добавлен' : 'ещё не выбран'}
						</div>
						<div class="flex items-center gap-2 text-[11px] font-medium {title.trim() ? 'text-emerald-400' : 'text-(--text-tertiary)'}">
							<Icon name={title.trim() ? 'check' : 'clock'} size={13} />
							Название {title.trim() ? 'есть' : 'ещё не заполнено'}
						</div>
						{#if linksLocked}
							<div class="flex items-center gap-2 text-[11px] font-medium {linksProblem ? 'text-red-400' : 'text-emerald-400'}">
								<Icon name={linksProblem ? 'x' : 'check'} size={13} />
								{linksProblem ? 'Уберите ссылки из текста' : 'Ссылок нет'}
							</div>
						{/if}
					</div>
					<button
						class="btn-primary h-12 w-full text-[14px] shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
						disabled={!canPublish}
						onclick={submit}
					>
						<Icon name="upload" size={18} />
						Опубликовать видео
					</button>
					<p class="mt-3 text-center text-[10px] leading-relaxed text-(--text-tertiary)">
						Нажимая кнопку, вы подтверждаете права на видео.
					</p>
				{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	.dropzone::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 0);
		background-size: 24px 24px;
		opacity: 0.35;
		mask-image: radial-gradient(ellipse at center, black 20%, transparent 75%);
		pointer-events: none;
	}

	.progress-bar {
		transition: width 0.2s ease;
		box-shadow: 0 0 18px -2px var(--accent);
	}
</style>
