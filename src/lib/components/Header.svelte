<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { themeStore } from '#lib/stores/theme.svelte';
	import { uiStore } from '#lib/stores/ui.svelte';
	import { clickOutside } from '#lib/actions/clickOutside';
	import type { SessionUser } from '#lib/types';
	import Logo from './Logo.svelte';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import VerifiedBadge from './VerifiedBadge.svelte';

	let { user, isAdmin = false, forceDrawer = false, notifications = [] }: { user: SessionUser | null; isAdmin?: boolean; forceDrawer?: boolean; notifications?: { id: string; title: string; channel: string; thumbnail: string | null }[] } = $props();

	let query = $state('');
	let themeMenu = $state(false);
	let createMenu = $state(false);
	let userMenu = $state(false);
	let notifMenu = $state(false);
	let searchInput = $state<HTMLInputElement>();
	let suggestOpen = $state(false);
	let suggestions = $state<{ videos: { id: string; title: string; thumbnail: string | null; channel: string; views: number }[]; channels: { id: string; name: string; image: string | null }[] }>({
		videos: [],
		channels: []
	});
	let suggestTimer: ReturnType<typeof setTimeout> | undefined;

	const themeOptions = [
		{ value: 'light', label: 'Светлая', icon: 'sun' },
		{ value: 'dark', label: 'Тёмная', icon: 'moon' },
		{ value: 'system', label: 'Как в системе', icon: 'monitor' }
	] as const;

	const themeIcon = $derived(
		themeStore.current === 'light' ? 'sun' : themeStore.current === 'dark' ? 'moon' : 'monitor'
	);

	const roleLabel = $derived(
		isAdmin ? 'Администратор' : user?.creator ? 'Создатель' : user?.verified ? 'Верифицированный' : ''
	);

	$effect(() => {
		const q = page.url.searchParams.get('q');
		if (q !== null) query = q;
	});

	$effect(() => {
		const q = query.trim();
		clearTimeout(suggestTimer);
		if (q.length < 2) {
			suggestOpen = false;
			return;
		}
		suggestTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
				if (res.ok) {
					suggestions = await res.json();
					suggestOpen = true;
				}
			} catch {
				suggestOpen = false;
			}
		}, 250);
		return () => clearTimeout(suggestTimer);
	});

	$effect(() => {
		// Close transient UI on navigation
		page.url.pathname;
		themeMenu = false;
		createMenu = false;
		userMenu = false;
		uiStore.closeMobileMenu();
		uiStore.searchOpen = false;
	});

	$effect(() => {
		const onKeydown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const typing =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;
			if (event.key === '/' && !typing) {
				event.preventDefault();
				searchInput?.focus();
			}
		};
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	function setTheme(value: 'light' | 'dark' | 'system') {
		themeStore.setTheme(value);
		themeMenu = false;
	}
</script>

<header class="sticky top-0 z-50 border-b border-(--border) glass">
	<div class="flex h-14 items-center gap-1.5 px-3 sm:px-4">
		<button class="icon-btn" onclick={() => (forceDrawer ? (uiStore.mobileMenuOpen = !uiStore.mobileMenuOpen) : uiStore.toggleSidebar())} aria-label="Меню">
			<Icon name="menu" size={22} />
		</button>

		<div class="ml-1 flex items-center">
			<Logo />
		</div>

		<div class="mx-auto hidden w-full max-w-[600px] items-center gap-2 px-4 md:flex 2xl:max-w-[780px]">
			<div class="relative w-full" use:clickOutside={() => (suggestOpen = false)}>
				<form action="/results" method="GET" class="flex h-10 w-full" onsubmit={() => (suggestOpen = false)}>
				<div class="relative flex-1">
					<span class="absolute top-1/2 left-3.5 -translate-y-1/2 text-(--text-tertiary)">
						<Icon name="search" size={18} />
					</span>
					<input
						bind:this={searchInput}
						bind:value={query}
						name="q"
						class="field h-10 w-full rounded-l-full rounded-r-none pl-10"
						placeholder="Введите запрос"
						aria-label="Поиск"
						autocomplete="off"
					/>
					{#if query}
						<button
							type="button"
							class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-(--text-tertiary) hover:bg-(--bg-active) hover:text-(--text)"
							onclick={() => (query = '')}
							aria-label="Очистить"
						>
							<Icon name="x" size={15} />
						</button>
					{/if}
				</div>
				<button
					class="flex w-16 items-center justify-center rounded-r-full border border-l-0 border-(--border) bg-(--bg-hover) text-(--text) transition hover:bg-(--bg-active)"
					aria-label="Найти"
				>
					<Icon name="search" size={20} />
				</button>
			</form>

			{#if suggestOpen && (suggestions.videos.length > 0 || suggestions.channels.length > 0)}
				<div class="menu-panel top-[calc(100%+8px)] right-0 left-0 max-h-[420px] overflow-y-auto" transition:fly={{ y: -6, duration: 140 }}>
					{#if suggestions.videos.length > 0}
						<p class="px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-(--text-tertiary) uppercase">Видео</p>
						{#each suggestions.videos as item (item.id)}
							<a href="/watch/{item.id}" class="menu-item" onclick={() => (suggestOpen = false)}>
								{#if item.thumbnail}
									<img src={item.thumbnail} alt="" class="h-9 w-14 shrink-0 rounded-[7px] object-cover" />
								{:else}
									<span class="flex h-9 w-14 shrink-0 items-center justify-center rounded-[7px] bg-(--bg-subtle)"><Icon name="play" size={14} /></span>
								{/if}
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[13px] font-medium">{item.title}</span>
									<span class="block truncate text-[11px] text-(--text-tertiary)">{item.channel}</span>
								</span>
							</a>
						{/each}
					{/if}

					{#if suggestions.channels.length > 0}
						<div class="my-1 h-px bg-(--border)"></div>
						<p class="px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-(--text-tertiary) uppercase">Каналы</p>
						{#each suggestions.channels as channel (channel.id)}
							<a href="/channel/{channel.id}" class="menu-item" onclick={() => (suggestOpen = false)}>
								<Avatar name={channel.name} image={channel.image} id={channel.id} size={28} />
								<span class="truncate text-[13px] font-medium">{channel.name}</span>
							</a>
						{/each}
					{/if}
				</div>
			{/if}
			</div>
		</div>

		<div class="ml-auto flex items-center gap-0.5 sm:gap-1">
			<button
				class="icon-btn md:hidden"
				onclick={() => (uiStore.searchOpen = !uiStore.searchOpen)}
				aria-label="Поиск"
			>
				<Icon name="search" size={21} />
			</button>

			{#if user}
				<div class="relative" use:clickOutside={() => (createMenu = false)}>
					<button
						class="ml-1 hidden h-9 items-center gap-2 rounded-full border border-(--border) bg-(--bg-subtle) pr-4 pl-3 text-[13px] font-semibold transition hover:bg-(--bg-hover) sm:flex"
						onclick={() => {
							createMenu = !createMenu;
							userMenu = false;
							themeMenu = false;
						}}
						aria-expanded={createMenu}
					>
						<Icon name="plus" size={18} strokeWidth={2.2} />
						Создать
					</button>
					<button
						class="icon-btn sm:hidden"
						onclick={() => {
							createMenu = !createMenu;
							userMenu = false;
							themeMenu = false;
						}}
						aria-label="Создать"
					>
						<Icon name="plus" size={22} />
					</button>

					{#if createMenu}
						<div
							class="menu-panel top-11 right-0 w-60"
							transition:fly={{ y: -6, duration: 140 }}
						>
							<a href="/upload" class="menu-item">
								<Icon name="upload" size={19} />
								<span>Загрузить видео</span>
							</a>
							<a href="/studio" class="menu-item">
								<Icon name="theater" size={19} />
								<span>Студия стримов</span>
							</a>
							<a href="/channel/{user.id}" class="menu-item">
								<Icon name="user" size={19} />
								<span>Мой канал</span>
							</a>
							<a href="/library" class="menu-item">
								<Icon name="film" size={19} />
								<span>Мои видео</span>
							</a>
							<div class="my-1 h-px bg-(--border)"></div>
							<a href="/settings" class="menu-item">
								<Icon name="settings" size={19} />
								<span>Настройки</span>
							</a>
						</div>
					{/if}
				</div>
			{/if}

			<div class="relative" use:clickOutside={() => (themeMenu = false)}>
				<button
					class="icon-btn"
					onclick={() => {
						themeMenu = !themeMenu;
						createMenu = false;
						userMenu = false;
					}}
					aria-label="Сменить тему"
					title="Тема оформления"
				>
					<Icon name={themeIcon} size={20} />
				</button>

				{#if themeMenu}
					<div class="menu-panel top-11 right-0 w-56" transition:fly={{ y: -6, duration: 140 }}>
						<p class="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-(--text-tertiary) uppercase">
							Тема оформления
						</p>
						{#each themeOptions as option (option.value)}
							<button class="menu-item" onclick={() => setTheme(option.value)}>
								<Icon name={option.icon} size={18} />
								<span class="flex-1">{option.label}</span>
								{#if themeStore.current === option.value}
									<Icon name="check" size={16} class="text-(--accent)" strokeWidth={2.4} />
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if user}
				<div class="relative ml-1" use:clickOutside={() => (notifMenu = false)}>
					<button
						class="icon-btn relative"
						onclick={() => {
							notifMenu = !notifMenu;
							userMenu = false;
							createMenu = false;
							themeMenu = false;
						}}
						aria-label="Уведомления"
						title="Новые видео от подписок"
					>
						<Icon name="bell" size={20} />
						{#if notifications.length > 0}
							<span class="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--text) px-1 text-[9px] font-bold text-(--bg)">{notifications.length}</span>
						{/if}
					</button>
					{#if notifMenu}
						<div class="menu-panel top-11 right-0 w-[320px]" transition:fly={{ y: -6, duration: 140 }}>
							<p class="px-3 py-2 text-[12px] font-bold">Новые видео от подписок</p>
							<div class="my-1 h-px bg-(--border)"></div>
							{#if notifications.length > 0}
								{#each notifications as item (item.id)}
									<a href="/shorts?v={item.id}" class="menu-item" onclick={() => (notifMenu = false)}>
										{#if item.thumbnail}<img src={item.thumbnail} alt="" class="h-9 w-14 shrink-0 rounded-[7px] object-cover" />{:else}<span class="h-9 w-14 shrink-0 rounded-[7px] bg-(--bg-subtle)"></span>{/if}
										<span class="min-w-0 flex-1"><span class="block truncate text-[12px] font-medium">{item.title}</span><span class="block truncate text-[11px] text-(--text-tertiary)">{item.channel}</span></span>
									</a>
								{/each}
							{:else}
								<p class="px-3 py-4 text-center text-[12px] text-(--text-tertiary)">Пока нет новых видео</p>
							{/if}
						</div>
					{/if}
				</div>

				<div class="relative ml-1" use:clickOutside={() => (userMenu = false)}>
					<button
						class="flex items-center rounded-full ring-(--accent) transition hover:ring-2 focus-visible:ring-2"
						onclick={() => {
							userMenu = !userMenu;
							createMenu = false;
							themeMenu = false;
						}}
						aria-label="Аккаунт"
					>
						<Avatar name={user.name} image={user.image} id={user.id} size={32} />
					</button>

					{#if userMenu}
						<div class="menu-panel top-11 right-0 w-64" transition:fly={{ y: -6, duration: 140 }}>
							<div class="flex items-center gap-3 px-2.5 py-2.5">
								<Avatar name={user.name} image={user.image} id={user.id} size={40} />
								<div class="min-w-0">
									<p class="flex items-center gap-1.5 text-sm font-semibold">
										<span class="truncate">{user.name}</span>
										{#if user.verified}
											<VerifiedBadge
												size={14}
												creator={Boolean(user.creator)}
												label={user.creator ? 'Создатель' : 'Верифицированный аккаунт'}
											/>
										{/if}
									</p>
									<p class="truncate text-xs text-(--text-secondary)">{user.email}</p>
									{#if roleLabel}
										<span class="mt-1 inline-flex rounded-[8px] bg-(--bg-subtle) px-2 py-0.5 text-[11px] font-bold {isAdmin ? 'text-(--accent)' : 'text-(--text-secondary)'}">
											{roleLabel}
										</span>
									{/if}
								</div>
							</div>
							<div class="my-1 h-px bg-(--border)"></div>
							{#if user.bannedUntil && new Date(user.bannedUntil) > new Date()}
								<div class="mx-1 mb-1 rounded-[10px] bg-(--bg-subtle) px-3 py-2 text-[11px] font-bold">
									Аккаунт заморожен · выкладка недоступна
								</div>
							{/if}
							<a href="/channel/{user.id}" class="menu-item">
								<Icon name="user" size={18} />
								<span>Мой канал</span>
							</a>
							<a href="/settings" class="menu-item">
								<Icon name="settings" size={18} />
								<span>Настройки</span>
							</a>
							{#if isAdmin}
								<a href="/admin" class="menu-item">
									<Icon name="lock" size={18} />
									<span>Админ-панель</span>
								</a>
							{/if}
							<div class="my-1 h-px bg-(--border)"></div>
							<form method="POST" action="/logout">
								<button type="submit" class="menu-item">
									<Icon name="logout" size={18} />
									<span>Выйти</span>
								</button>
							</form>
						</div>
					{/if}
				</div>
			{:else}
				<a href="/login" class="btn-secondary ml-1 h-9 px-4 text-[13px]">
					<Icon name="login" size={17} />
					<span class="hidden sm:inline">Войти</span>
				</a>
			{/if}
		</div>
	</div>

	{#if uiStore.searchOpen}
		<div class="border-t border-(--border) px-3 py-2.5 md:hidden">
			<div class="relative" use:clickOutside={() => (suggestOpen = false)}>
				<form action="/results" method="GET" class="flex h-10 w-full" onsubmit={() => { uiStore.searchOpen = false; suggestOpen = false; }}>
					<input
						bind:value={query}
						name="q"
						class="field h-10 w-full rounded-full px-4"
						placeholder="Введите запрос"
						aria-label="Поиск"
						autocomplete="off"
					/>
					<button class="icon-btn ml-1" aria-label="Найти">
						<Icon name="search" size={20} />
					</button>
				</form>

				{#if suggestOpen && suggestions.videos.length > 0}
					<div class="menu-panel top-[calc(100%+8px)] right-0 left-0 max-h-[360px] overflow-y-auto" transition:fly={{ y: -6, duration: 140 }}>
						{#each suggestions.videos as item (item.id)}
							<a href="/watch/{item.id}" class="menu-item" onclick={() => { suggestOpen = false; uiStore.searchOpen = false; }}>
								{#if item.thumbnail}
									<img src={item.thumbnail} alt="" class="h-9 w-14 shrink-0 rounded-[7px] object-cover" />
								{:else}
									<span class="flex h-9 w-14 shrink-0 items-center justify-center rounded-[7px] bg-(--bg-subtle)"><Icon name="play" size={14} /></span>
								{/if}
								<span class="min-w-0 flex-1 truncate text-[13px] font-medium">{item.title}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</header>
