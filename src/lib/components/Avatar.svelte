<script lang="ts">
	import { colorFor, initials } from '#lib/utils/format';

	let {
		name,
		image,
		id,
		size = 36,
		square = false,
		class: className = ''
	}: {
		name: string;
		image?: string | null;
		id?: string;
		size?: number;
		square?: boolean;
		class?: string;
	} = $props();

	const seed = $derived(id ?? name);
</script>

<span
	class="inline-flex shrink-0 items-center justify-center overflow-hidden select-none {square ? 'rounded-[28%]' : 'rounded-full'} {className}"
	style="width:{size}px;height:{size}px;background:{image ? 'var(--bg-hover)' : colorFor(seed)};"
	aria-hidden="true"
>
	{#if image}
		<img src={image} alt="" class="h-full w-full object-cover" loading="lazy" />
	{:else}
		<span
			class="font-semibold text-white"
			style="font-size:{Math.max(10, size * 0.36)}px;letter-spacing:0.02em;"
		>
			{initials(name)}
		</span>
	{/if}
</span>
