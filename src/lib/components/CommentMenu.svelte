<script lang="ts">
	import { fly } from 'svelte/transition';
	import { clickOutside } from '#lib/actions/clickOutside';
	import Icon from './Icon.svelte';

	let {
		commentId,
		authorId,
		ownerId,
		currentUserId,
		pinned = false,
		onupdate = () => {}
	}: {
		commentId: string;
		authorId: string;
		ownerId: string;
		currentUserId?: string | null;
		pinned?: boolean;
		onupdate?: () => void;
	} = $props();

	let open = $state(false);
	let busy = $state(false);

	const canModerate = $derived(Boolean(currentUserId && currentUserId === ownerId));
	const canDelete = $derived(canModerate || currentUserId === authorId);

	async function action(kind: 'pin' | 'delete' | 'report' | 'block') {
		if (!currentUserId || busy) return;
		busy = true;
		try {
			if (kind === 'pin') {
				await fetch(`/api/comments/${commentId}`, { method: 'PATCH' });
			} else if (kind === 'delete') {
				await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
			} else if (kind === 'report') {
				await fetch(`/api/comments/${commentId}/report`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ reason: 'Неподходящий комментарий' })
				});
			} else {
				await fetch(`/api/users/${authorId}/block`, { method: 'POST' });
			}
			open = false;
			onupdate();
		} catch {}
		busy = false;
	}
</script>

<div class="relative" use:clickOutside={() => (open = false)}>
	<button
		class="flex h-8 w-8 items-center justify-center rounded-full text-(--text-tertiary) transition hover:bg-(--bg-hover) hover:text-(--text)"
		onclick={() => (open = !open)}
		aria-label="Действия с комментарием"
	>
		<Icon name="moreVertical" size={17} strokeWidth={2.4} />
	</button>

	{#if open}
		<div class="menu-panel top-8 right-0 z-30 w-48" transition:fly={{ y: -6, duration: 140 }}>
			{#if canModerate}
				<button class="menu-item" onclick={() => action('pin')} disabled={busy}>
					<Icon name="sparkles" size={16} />
					<span>{pinned ? 'Открепить' : 'Закрепить'}</span>
				</button>
			{/if}
			{#if canDelete}
				<button class="menu-item" onclick={() => action('delete')} disabled={busy}>
					<Icon name="trash" size={16} />
					<span>Удалить</span>
				</button>
			{/if}
			<button class="menu-item" onclick={() => action('report')} disabled={busy}>
				<Icon name="info" size={16} />
				<span>Пожаловаться</span>
			</button>
			<button class="menu-item" onclick={() => action('block')} disabled={busy}>
				<Icon name="lock" size={16} />
				<span>Заблокировать</span>
			</button>
		</div>
	{/if}
</div>
