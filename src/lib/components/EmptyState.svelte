<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		icon = 'film',
		title,
		description,
		children
	}: {
		icon?: 'film' | 'history' | 'search' | 'upload' | 'subscriptions' | 'users' | 'heart' | 'video';
		title: string;
		description: string;
		children?: Snippet;
	} = $props();

	const iconName = icon === 'video' ? 'film' : icon;
</script>

<div class="animate-in flex flex-col items-center justify-center px-6 py-20 text-center">
	<div
		class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-(--border) bg-(--bg-subtle) text-(--text-tertiary)"
	>
		<Icon name={iconName} size={28} />
	</div>
	<h2 class="font-display text-xl font-bold tracking-tight">{title}</h2>
	<p class="mt-2 max-w-md text-sm leading-relaxed text-(--text-secondary)">{description}</p>
	{#if children}
		<div class="mt-6">{@render children()}</div>
	{/if}
</div>
