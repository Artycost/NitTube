<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import Header from '#lib/components/Header.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const bare = $derived(
		page.url.pathname === '/login' ||
			page.url.pathname === '/register' ||
			page.url.pathname === '/studio' ||
			page.url.pathname.startsWith('/help')
	);
	const watchPage = $derived(page.url.pathname.startsWith('/watch/'));
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

<div class="min-h-dvh bg-(--bg) text-(--text)">
	{#if bare}
		{@render children()}
	{:else}
		<Header user={data.user} isAdmin={data.isAdmin} notifications={data.notifications} forceDrawer={watchPage} />
		{#if data.ban?.banned}
			<div class="flex flex-wrap items-center justify-center gap-2 bg-(--bg-elevated) px-4 py-2 text-center text-[12px] font-semibold text-(--text)" role="alert">
				<Icon name="lock" size={15} />
				Загрузка видео заблокирована ещё {data.ban.daysLeft} дн. · {data.ban.reason}
			</div>
		{/if}
		<div class="flex">
			<Sidebar user={data.user} subscriptions={data.subscriptions} desktopHidden={watchPage} />
			<main class="min-h-[calc(100dvh-3.5rem)] min-w-0 flex-1">
				{@render children()}
			</main>
		</div>
	{/if}

	<Toasts />
</div>
