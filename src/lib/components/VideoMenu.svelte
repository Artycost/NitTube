<script lang="ts">
	import { fly } from 'svelte/transition';
	import { clickOutside } from '#lib/actions/clickOutside';
	import { toasts } from '#lib/stores/toast.svelte';
	import Icon from './Icon.svelte';

	let { videoId, ownerId = '' }: { videoId: string; ownerId?: string } = $props();

	let open = $state(false);
	let busy = $state(false);

	const reasons = [
		{ value: 'copyright', label: 'Нарушение авторских прав' },
		{ value: 'sexual', label: 'Неприемлемый контент 18+' },
		{ value: 'violence', label: 'Насилие / шок' },
		{ value: 'spam', label: 'Спам' },
		{ value: 'hate', label: 'Оскорбления' },
		{ value: 'other', label: 'Другое' }
	] as const;

	async function report(reason: string) {
		if (busy) return;
		busy = true;
		const res = await fetch(`/api/videos/${videoId}/report`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ reason })
		});
		busy = false;
		open = false;
		if (res.ok) toasts.success('Жалоба отправлена на модерацию');
		else toasts.error('Не удалось отправить жалобу');
	}
</script>

<div class="video-menu" use:clickOutside={() => (open = false)}>
	<button
		class="menu-trigger"
		onclick={(e) => { e.stopPropagation(); e.preventDefault(); open = !open; }}
		aria-label="Действия с видео"
		title="Действия"
	>
		<Icon name="moreVertical" size={17} strokeWidth={2.5} />
	</button>

	{#if open}
		<div class="menu-panel top-8 right-0 z-40 w-56" transition:fly={{ y: -6, duration: 140 }}>
			<p class="px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-(--text-tertiary) uppercase">Пожаловаться</p>
			{#each reasons as reason (reason.value)}
				<button class="menu-item" onclick={() => report(reason.value)} disabled={busy}>
					<Icon name={reason.value === 'copyright' ? 'lock' : 'info'} size={15} />
					<span>{reason.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.video-menu {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 20;
	}
	.menu-trigger {
		display: inline-flex;
		height: 30px;
		width: 30px;
		align-items: center;
		justify-content: center;
		border-radius: 9px;
		background: rgb(0 0 0 / 0.55);
		color: #fff;
		backdrop-filter: blur(10px);
		opacity: 1;
		transition: transform 0.18s ease, background-color 0.18s ease;
	}
	.menu-trigger:hover {
		background: rgb(0 0 0 / 0.8);
		transform: scale(1.08);
	}
	@media (hover: none) {
		.menu-trigger { opacity: 1; }
	}
</style>
