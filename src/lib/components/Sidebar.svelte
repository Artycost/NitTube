<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { uiStore } from '#lib/stores/ui.svelte';
	import type { ChannelSummary, SessionUser } from '#lib/types';
	import Icon from './Icon.svelte';
	import Avatar from './Avatar.svelte';
	import ShortsLogo from './ShortsLogo.svelte';

	let {
		user,
		subscriptions,
		desktopHidden = false
	}: {
		user: SessionUser | null;
		subscriptions: ChannelSummary[];
		desktopHidden?: boolean;
	} = $props();

	const mainItems = [{ href: '/', label: 'Главная', icon: 'home' }] as const;

	let subscriptionsExpanded = $state(false);

	function isActive(href: string) {
		const pathname = page.url.pathname;
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

{#snippet navigation(collapsed: boolean)}
	<div class="flex h-full flex-col gap-1 overflow-y-auto px-2.5 pt-3 pb-6 no-scrollbar">
		<nav class="flex flex-col gap-0.5">
			{#each mainItems as item (item.href)}
				<a
					href={item.href}
					class="nav-item {isActive(item.href) ? 'nav-item-active' : ''} {collapsed
						? 'flex-col justify-center gap-1 px-0 py-3 text-[10px]'
						: ''}"
					title={collapsed ? item.label : undefined}
				>
					<Icon name={item.icon} size={22} filled />
					<span class={collapsed ? 'leading-none' : ''}>{item.label}</span>
				</a>
			{/each}
			<a
				href="/shorts"
				class="nav-item {isActive('/shorts') ? 'nav-item-active' : ''} {collapsed ? 'flex-col justify-center gap-1 px-0 py-3 text-[10px]' : ''}"
				title={collapsed ? 'Shorts' : undefined}
			>
				<ShortsLogo size={18} />
				<span class={collapsed ? 'leading-none' : ''}>Shorts</span>
			</a>
		</nav>

		<div class="hairline my-2"></div>

		{#if !collapsed}
			<a href="/subscriptions" class="side-section-link">
				<span>Подписки</span>
				<Icon name="chevronRight" size={15} />
			</a>
		{/if}

		<nav class="flex flex-col gap-0.5">
			{#each (subscriptionsExpanded ? subscriptions : subscriptions.slice(0, 8)) as channel (channel.id)}
				<a
					href="/channel/{channel.id}"
					class="side-sub {isActive(`/channel/${channel.id}`) ? 'nav-item-active' : ''} {collapsed ? 'justify-center px-0 py-2' : ''}"
					title={channel.name}
				>
					<Avatar name={channel.name} image={channel.image} id={channel.id} size={collapsed ? 26 : 24} />
					{#if !collapsed}
						<span class="min-w-0 flex-1 truncate">{channel.name}</span>
						<span class="side-dot"></span>
					{/if}
				</a>
			{/each}
		</nav>

		{#if !collapsed}
			<button class="side-expand" onclick={() => (subscriptionsExpanded = !subscriptionsExpanded)}>
				<span>{subscriptionsExpanded ? 'Свернуть' : 'Развернуть'}</span>
				<Icon name={subscriptionsExpanded ? 'chevronUp' : 'chevronDown'} size={15} />
			</button>
		{/if}

		<div class="hairline my-2"></div>

		<nav class="flex flex-col gap-0.5">
			<a
				href="/settings"
				class="nav-item {isActive('/settings') ? 'nav-item-active' : ''} {collapsed
					? 'flex-col justify-center gap-1 px-0 py-3 text-[10px]'
					: ''}"
				title={collapsed ? 'Настройки' : undefined}
			>
				<Icon name="settings" size={22} filled />
				<span class={collapsed ? 'leading-none' : ''}>Настройки</span>
			</a>
			{#if user}
				<a
					href="/upload"
					class="nav-item {isActive('/upload') ? 'nav-item-active' : ''} {collapsed
						? 'flex-col justify-center gap-1 px-0 py-3 text-[10px]'
						: ''}"
					title={collapsed ? 'Загрузить' : undefined}
				>
					<Icon name="upload" size={22} filled />
					<span class={collapsed ? 'leading-none' : ''}>Загрузить</span>
				</a>
			{/if}
			<a
				href="/help"
				class="nav-item {isActive('/help') ? 'nav-item-active' : ''} {collapsed
					? 'flex-col justify-center gap-1 px-0 py-3 text-[10px]'
					: ''}"
				title={collapsed ? 'Справка' : undefined}
			>
				<Icon name="info" size={22} filled />
				<span class={collapsed ? 'leading-none' : ''}>Справка</span>
			</a>
		</nav>

	</div>
{/snippet}

<!-- Desktop sidebar -->
<aside
	class="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 border-r border-(--border) bg-(--bg) transition-[width] duration-200 {desktopHidden ? '' : 'lg:block'} {uiStore.sidebarCollapsed
		? 'w-[76px] 2xl:w-[92px]'
		: 'w-[240px] 2xl:w-[280px]'}"
>
	{@render navigation(uiStore.sidebarCollapsed)}
</aside>

<!-- Mobile drawer -->
{#if uiStore.mobileMenuOpen}
	<div class="fixed inset-0 z-[70]">
		<button
			class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
			onclick={() => uiStore.closeMobileMenu()}
			aria-label="Закрыть меню"
		></button>
		<aside
			class="absolute top-0 left-0 flex h-full w-[280px] flex-col border-r border-(--border) bg-(--bg) shadow-2xl"
			transition:fly={{ x: -280, duration: 220 }}
		>
			<div class="flex h-14 items-center gap-2 border-b border-(--border) px-3">
				<button class="icon-btn" onclick={() => uiStore.closeMobileMenu()} aria-label="Закрыть">
					<Icon name="x" size={21} />
				</button>
				<span class="font-display text-lg font-extrabold tracking-tight">
					Vue<span class="text-(--accent)">Tube</span>
				</span>
			</div>
			{@render navigation(false)}
		</aside>
	</div>
{/if}

<style>
	.side-section-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: 12px;
		padding: 9px 10px;
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		transition: background-color 0.18s ease;
	}
	.side-section-link:hover { background: rgb(255 255 255 / 0.06); }
	.side-sub {
		display: flex;
		min-height: 38px;
		align-items: center;
		gap: 10px;
		border-radius: 12px;
		padding: 0.35rem 0.6rem;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		transition: background-color 0.18s ease, color 0.18s ease;
	}
	.side-sub:hover { background: rgb(255 255 255 / 0.06); color: var(--text); }
	.side-dot { height: 6px; width: 6px; flex-shrink: 0; border-radius: 999px; background: #3b82f6; }
	.side-expand {
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: 12px;
		padding: 9px 10px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		transition: background-color 0.18s ease, color 0.18s ease;
	}
	.side-expand:hover { background: rgb(255 255 255 / 0.06); color: var(--text); }
</style>
