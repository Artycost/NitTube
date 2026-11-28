<script lang="ts">
	import { scale } from 'svelte/transition';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Удалить',
		onconfirm
	}: {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		onconfirm: () => Promise<void> | void;
	} = $props();

	let loading = $state(false);

	async function confirm() {
		if (loading) return;
		loading = true;
		try {
			await onconfirm();
			open = false;
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<button
			class="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
			onclick={() => (open = false)}
			aria-label="Закрыть"
		></button>
		<div
			class="relative w-full max-w-sm rounded-2xl border border-(--border) bg-(--bg-elevated) p-5 shadow-2xl"
			transition:scale={{ start: 0.95, opacity: 0, duration: 160 }}
		>
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
				<Icon name="trash" size={19} />
			</div>
			<h2 class="font-display text-lg font-bold tracking-tight">{title}</h2>
			<p class="mt-1.5 text-sm leading-relaxed text-(--text-secondary)">{description}</p>
			<div class="mt-5 flex justify-end gap-2">
				<button class="btn-secondary h-9 px-4 text-[13px]" onclick={() => (open = false)} disabled={loading}>
					Отмена
				</button>
				<button
					class="flex h-9 items-center justify-center rounded-full bg-red-500 px-4 text-[13px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
					onclick={confirm}
					disabled={loading}
				>
					{loading ? 'Удаление…' : confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
