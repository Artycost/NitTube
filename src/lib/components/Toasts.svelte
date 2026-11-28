<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '#lib/stores/toast.svelte';
	import Icon from './Icon.svelte';
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4">
	{#each toasts.items as item (item.id)}
		<div
			transition:fly={{ y: 16, duration: 220 }}
			class="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-(--radius-pill) border border-(--border) bg-(--bg-elevated) py-2.5 pr-3 pl-4 text-sm shadow-(--shadow-card)"
		>
			<span
				class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
				class:text-emerald-500={item.type === 'success'}
				class:text-red-500={item.type === 'error'}
				class:text-sky-500={item.type === 'info'}
			>
				{#if item.type === 'success'}
					<Icon name="check" size={16} strokeWidth={2.4} />
				{:else if item.type === 'error'}
					<Icon name="info" size={16} strokeWidth={2.2} />
				{:else}
					<Icon name="info" size={16} strokeWidth={2.2} />
				{/if}
			</span>
			<span class="font-medium">{item.message}</span>
			<button
				class="ml-1 rounded-full p-1 text-(--text-tertiary) transition hover:bg-(--bg-hover) hover:text-(--text)"
				onclick={() => toasts.dismiss(item.id)}
				aria-label="Закрыть"
			>
				<Icon name="x" size={14} strokeWidth={2.2} />
			</button>
		</div>
	{/each}
</div>
