<script lang="ts">
	import BrandLogo from './BrandLogo.svelte';
	let { compact = false }: { compact?: boolean } = $props();
</script>

<a href="/" class="group flex items-center gap-2" aria-label="VueTube — на главную">
	<span class="flex shrink-0 items-center justify-center text-(--text) transition-transform duration-300 group-hover:scale-105">
		<BrandLogo size={34} />
	</span>
	{#if !compact}
		<span class="font-display text-[21px] leading-none font-extrabold tracking-[-0.03em]">
			Vue<span class="text-(--accent)">Tube</span>
		</span>
	{/if}
</a>
