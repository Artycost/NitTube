<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import Icon from '#lib/components/Icon.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import { toasts } from '#lib/stores/toast.svelte';
	import { formatDuration } from '#lib/utils/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showKey = $state(false);
	let editing = $state(false);
	let latency = $state('low');
	let videoCoder = $state(true);
	let panorama = $state(false);
	let subtitles = $state(false);
	let saveAsUnlisted = $state(false);
	let chatText = $state('');
	let chat = $state<{ id: number; name: string; text: string }[]>([
		{ id: 1, name: 'VueTube', text: 'Добро пожаловать в студию стримов!' }
	]);
	let elapsed = $state(0);

	$effect(() => {
		if (!data.stream.isLive || !data.stream.startedAt) return;
		const tick = () => {
			elapsed = Math.floor((Date.now() - new Date(data.stream.startedAt!).getTime()) / 1000);
		};
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	});

	async function refresh() {
		await invalidateAll();
	}

	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toasts.success('Скопировано');
		} catch {
			toasts.error('Не удалось скопировать');
		}
	}

	function sendChat() {
		if (!chatText.trim()) return;
		chat = [...chat, { id: Date.now(), name: 'Вы', text: chatText.trim() }];
		chatText = '';
	}
</script>

<svelte:head>
	<title>Studio — VueTube</title>
</svelte:head>

<div class="flex min-h-dvh bg-(--bg) text-(--text)">
	<aside class="sticky top-0 flex h-dvh w-14 shrink-0 flex-col items-center gap-1 bg-(--bg-elevated) py-3">
		<div class="mb-3 flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--text) text-(--bg)"><Icon name="play" size={16} filled /></div>
		<button class="rail-btn" title="Главная"><Icon name="home" size={19} /></button>
		<button class="rail-btn" title="Видео"><Icon name="film" size={19} /></button>
		<button class="rail-btn" title="Аналитика"><Icon name="chart" size={19} /></button>
		<a href="/" class="rail-btn mt-auto" title="На сайт"><Icon name="logout" size={19} /></a>
		<a href="/settings" class="rail-btn" title="Настройки"><Icon name="settings" size={19} /></a>
	</aside>

	<div class="min-w-0 flex-1">
		<header class="flex h-14 items-center gap-3 bg-(--bg-elevated) px-4 sm:px-6">
			<div class="flex items-center gap-2">
				<span class="flex h-7 w-9 items-center justify-center rounded-[9px] bg-(--text) text-(--bg)"><Icon name="play" size={15} filled /></span>
				<span class="font-display text-[18px] font-extrabold tracking-[-0.03em]">VueTube Studio</span>
			</div>
			<div class="ml-auto flex items-center gap-1">
				<button class="icon-btn" title="Ключ"><Icon name="lock" size={18} /></button>
				<a href="/help" class="icon-btn" title="Справка"><Icon name="info" size={18} /></a>
				<a href="/" class="icon-btn" title="На сайт"><Icon name="logout" size={18} /></a>
				<Avatar name={data.channelName || 'Studio'} size={30} />
			</div>
		</header>

		<main class="studio-main px-4 pt-5 pb-16 sm:px-6">
			{#if form?.message}
				<div class="mb-4 rounded-[12px] bg-(--bg-elevated) px-4 py-3 text-[13px] text-(--accent)">{form.message}</div>
			{/if}

			<div class="studio-top">
				<section class="panel p-5">
					<div class="mb-4 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full" class:dot-live={data.stream.isLive}></span>
						<span class="text-[12px] font-bold">{data.stream.isLive ? 'В эфире' : 'Нет данных'}</span>
						<span class="ml-auto text-[11px] text-(--text-tertiary)">{data.stream.isLive ? formatDuration(elapsed) : 'Ожидание видеокодера'}</span>
					</div>
					<div class="flex min-h-[150px] flex-col items-center justify-center gap-3 text-center">
						<Icon name="theater" size={34} class="text-(--text-tertiary)" />
						<p class="text-[14px] font-bold">Чтобы начать трансляцию, подключите видеокодер</p>
						<p class="max-w-md text-[12px] text-(--text-secondary)">Скопируйте ключ трансляции и вставьте его в OBS</p>
						<div class="mt-1 flex items-center gap-2">
							<button class="btn-secondary h-9 px-4 text-[12px]" onclick={() => copy(data.streamKey)}><Icon name="copy" size={15} />Ключ: Default stream key</button>
							<form method="POST" action="?/regenerate" use:enhance={() => refresh}>
								<button class="icon-btn" title="Обновить ключ"><Icon name="loader" size={17} /></button>
							</form>
						</div>
						<form method="POST" action="?/test" use:enhance class="mt-2">
							<button class="btn-secondary h-9 px-4 text-[12px]">Проверить RTMP-сервер</button>
						</form>
						{#if form?.message}
							<p class="mt-1 text-[11px] text-(--text-secondary)">{form.message}</p>
						{/if}
					</div>
				</section>

				<section class="panel p-5">
					<div class="mb-4 flex items-center gap-2">
						<span class="text-[12px] font-bold">Вертикальный стрим</span>
						<Icon name="chevronDown" size={15} class="ml-auto text-(--text-tertiary)" />
					</div>
					<p class="text-[13px] font-semibold">Вертикальная трансляция отключена</p>
					<p class="mt-2 text-[12px] leading-relaxed text-(--text-secondary)">
						Используйте вертикальный макет или видеокодер, чтобы привлечь больше зрителей. Подробнее…
					</p>
					<p class="mt-4 text-[11px] text-(--text-tertiary)">Stream key: {showKey ? data.streamKey : '••••••••••••••••'}</p>
					<button class="mt-2 text-[11px] font-semibold text-(--text-secondary) transition hover:text-(--text)" onclick={() => (showKey = !showKey)}>
						{showKey ? 'Скрыть ключ' : 'Показать ключ'}
					</button>
				</section>
			</div>

			<div class="status-bar mt-4 flex flex-wrap items-center gap-3 px-5 py-3">
				<span class="h-2 w-2 rounded-full bg-(--text-tertiary)"></span>
				<span class="text-[12px] text-(--text-secondary)">
					{data.stream.isLive ? 'Трансляция активна' : 'Чтобы начать трансляцию, включите видеокодер.'}
				</span>
				{#if data.stream.isLive}
					<form method="POST" action="?/stop" use:enhance={() => refresh}>
						<button class="btn-secondary ml-auto h-9 px-4 text-[12px]">Завершить эфир</button>
					</form>
					<a href="/live/{data.stream.id}" class="btn-secondary h-9 px-4 text-[12px]">Смотреть эфир</a>
				{:else}
					<form method="POST" action="?/start" use:enhance={() => refresh}>
						<button class="btn-primary ml-auto h-9 px-4 text-[12px]" disabled={data.banned.banned}>Включить эфир</button>
					</form>
				{/if}
			</div>

			<div class="tabs mt-4 flex gap-2">
				<button class="tab tab-active">Настройки трансляции</button>
				<button class="tab">Аналитика</button>
				<button class="tab">Состояние трансляции</button>
			</div>

			<div class="studio-grid mt-4">
				<div class="panel p-5">
					<h2 class="mb-4 text-[13px] font-bold">URL трансляции</h2>
					<p class="mb-1.5 text-[11px] text-(--text-tertiary)">URL трансляции</p>
					<div class="flex gap-2">
						<div class="field flex h-10 min-w-0 flex-1 items-center px-3 text-[12px]">{data.serverUrl}</div>
						<button class="btn-secondary h-10 px-3 text-[12px]" onclick={() => copy(data.serverUrl)}>Копировать</button>
					</div>
					<p class="mt-4 mb-1.5 text-[11px] text-(--text-tertiary)">URL резервного сервера</p>
					<div class="flex gap-2">
						<div class="field flex h-10 min-w-0 flex-1 items-center px-3 text-[12px]">{data.serverUrl}/backup</div>
						<button class="btn-secondary h-10 px-3 text-[12px]" onclick={() => copy(data.serverUrl + '/backup')}>Копировать</button>
					</div>
					<a href="#" class="mt-2 inline-block text-[11px] text-(--text-secondary) underline">Подробнее…</a>

					<h3 class="mb-3 mt-7 text-[13px] font-bold">Задержка трансляции</h3>
					{#each [{ v: 'normal', label: 'Стандартная задержка' }, { v: 'low', label: 'Малая задержка' }, { v: 'min', label: 'Наименьшая задержка' }] as option (option.v)}
						<label class="flex cursor-pointer items-center gap-3 py-2 text-[12px]">
							<input type="radio" bind:group={latency} value={option.v} class="accent-(--text)" />
							<span>{option.label}</span>
						</label>
					{/each}
					<p class="mt-1 text-[11px] leading-relaxed text-(--text-tertiary)">Если выбрать этот вариант, то разрешение 1440p и 4К и субтитры станут недоступны.</p>
				</div>

				<div>
					<section class="panel p-5">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="text-[11px] text-(--text-tertiary)">Название</p>
								{#if editing}
									<form method="POST" action="?/save" use:enhance={() => { editing = false; return refresh; }} class="mt-2 flex gap-2">
										<input name="title" value={data.stream.title} class="field h-9 min-w-0 flex-1 px-3 text-[12px]" />
										<button class="btn-primary h-9 px-3 text-[12px]">ОК</button>
									</form>
								{:else}
									<p class="mt-1 truncate text-[13px] font-bold">{data.stream.title || 'Стрим без названия'}</p>
								{/if}
								<p class="mt-3 text-[11px] text-(--text-tertiary)">Категория</p>
								<p class="mt-0.5 text-[12px]">{data.stream.category}</p>
								<p class="mt-3 text-[11px] text-(--text-tertiary)">Доступ</p>
								<p class="mt-0.5 text-[12px]">Для всех</p>
							</div>
							<button class="btn-secondary h-8 shrink-0 px-3 text-[11px]" onclick={() => (editing = !editing)}>Изменить</button>
						</div>
						<p class="mt-5 text-[11px] text-(--text-tertiary)">Ожидающее число зрителей</p>
						<p class="mt-1 text-[12px] font-bold">{data.stream.viewers}</p>
					</section>

					<section class="panel mt-4 p-5">
						<h3 class="mb-3 text-[13px] font-bold">Дополнительные настройки</h3>
						<div class="flex items-center justify-between py-2.5 text-[12px]"><span>Видеокодер</span><button class="switch" class:on={videoCoder} onclick={() => (videoCoder = !videoCoder)}><span></span></button></div>
						<div class="flex items-center justify-between py-2.5 text-[12px]"><span>Панорамное видео</span><button class="switch" class:on={panorama} onclick={() => (panorama = !panorama)}><span></span></button></div>
						<div class="flex items-center justify-between py-2.5 text-[12px]"><span>Субтитры</span><button class="switch" class:on={subtitles} onclick={() => (subtitles = !subtitles)}><span></span></button></div>
						<div class="flex items-center justify-between py-2.5 text-[12px]"><span>Записи трансляции по ссылке</span><button class="switch" class:on={saveAsUnlisted} onclick={() => (saveAsUnlisted = !saveAsUnlisted)}><span></span></button></div>
					</section>
				</div>

				<section class="chat-panel flex flex-col">
					<div class="flex items-center gap-2 px-4 py-3">
						<span class="text-[12px] font-bold">Интересные…</span>
						<button class="ml-auto text-(--text-tertiary)"><Icon name="moreVertical" size={16} /></button>
					</div>
					<div class="flex-1 space-y-3 overflow-y-auto px-4 py-2">
						{#each chat as message (message.id)}
							<p class="text-[12px]"><strong class="font-bold">{message.name}</strong> {message.text}</p>
						{/each}
					</div>
					<form class="flex items-center gap-2 p-3" onsubmit={(e) => { e.preventDefault(); sendChat(); }}>
						<input bind:value={chatText} class="field h-9 min-w-0 flex-1 px-3 text-[12px]" placeholder="Написать в чат" />
						<button type="submit" class="icon-btn"><Icon name="send" size={16} /></button>
						<button type="button" class="icon-btn"><Icon name="smile" size={16} /></button>
					</form>
				</section>
			</div>
		</main>
	</div>
</div>

<style>
	.panel,
	.status-bar,
	.chat-panel,
	.tab {
		background: var(--bg-elevated);
		border-radius: 16px;
	}
	.rail-btn {
		display: inline-flex;
		height: 38px;
		width: 38px;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		color: var(--text-secondary);
		transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
	}
	.rail-btn:hover { background: var(--bg-hover); color: var(--text); transform: scale(1.06); }
	.studio-main { max-width: 1600px; margin: 0 auto; }
	.studio-top { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
	.studio-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
	.tab { padding: 9px 16px; font-size: 12px; font-weight: 700; color: var(--text-secondary); }
	.tab-active { background: var(--bg-subtle); color: var(--text); }
	.field { background: var(--bg-subtle); color: var(--text); outline: none; }
	.switch { position: relative; height: 22px; width: 40px; border-radius: 999px; background: var(--bg-active); transition: background-color .2s ease; }
	.switch span { position: absolute; top: 3px; left: 3px; height: 16px; width: 16px; border-radius: 999px; background: #fff; transition: transform .22s cubic-bezier(.16,1,.3,1); }
	.switch.on { background: var(--text); }
	.switch.on span { transform: translateX(18px); background: var(--bg); }
	.dot-live { background: #e5484d; box-shadow: 0 0 0 4px rgb(229 72 77 / 0.2); animation: pulse 1.4s ease-in-out infinite; }
	@keyframes pulse { 50% { opacity: 0.5; } }
	@media (min-width: 1024px) {
		.studio-top { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
		.studio-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) 320px; align-items: start; }
	}
	@media (max-width: 1023px) { .chat-panel { min-height: 320px; } }
</style>
