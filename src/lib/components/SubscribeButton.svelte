<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toasts } from '#lib/stores/toast.svelte';
	import { formatCompact } from '#lib/utils/format';
	import Icon from './Icon.svelte';

	let {
		channelId,
		subscribed: initialSubscribed,
		count: initialCount,
		showCount = true,
		onchange
	}: {
		channelId: string;
		subscribed: boolean;
		count: number;
		showCount?: boolean;
		onchange?: (subscribed: boolean, count: number) => void;
	} = $props();

	let subscribed = $state(initialSubscribed);
	let count = $state(initialCount);
	let loading = $state(false);

	$effect(() => {
		subscribed = initialSubscribed;
		count = initialCount;
	});

	async function toggle() {
		if (!page.data.user) {
			goto(`/login?redirect=${encodeURIComponent(page.url.pathname)}`);
			return;
		}

		if (loading) return;
		loading = true;

		const next = !subscribed;
		subscribed = next;
		count = Math.max(0, count + (next ? 1 : -1));

		try {
			const response = await fetch(`/api/channels/${channelId}/subscribe`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ subscribed: next })
			});

			if (!response.ok) throw new Error('request failed');

			const data = (await response.json()) as { subscribed: boolean; count: number };
			subscribed = data.subscribed;
			count = data.count;
			onchange?.(subscribed, count);
			toasts.success(subscribed ? 'Вы подписались на канал' : 'Вы отписались от канала');
		} catch {
			subscribed = !next;
			count = Math.max(0, count + (next ? -1 : 1));
			toasts.error('Не удалось изменить подписку');
		} finally {
			loading = false;
		}
	}
</script>

<button
	class="{subscribed ? 'btn-secondary' : 'btn-primary'} h-9 gap-2 px-4 text-[13px]"
	onclick={toggle}
	disabled={loading}
	aria-pressed={subscribed}
>
	<Icon name={subscribed ? 'check' : 'plus'} size={16} strokeWidth={2.3} />
	<span>{subscribed ? 'Вы подписаны' : 'Подписаться'}</span>
	{#if showCount && count > 0}
		<span class="text-xs font-medium opacity-70">{formatCompact(count)}</span>
	{/if}
</button>
