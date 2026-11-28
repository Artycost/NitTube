<script lang="ts">
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import { formatViews } from '#lib/utils/format';

	let {
		stream
	}: {
		stream: {
			id: string;
			title: string;
			category: string;
			viewers: number;
			userId: string;
			name: string;
			image: string | null;
		};
	} = $props();
</script>

<a href="/watch/{stream.id}" class="hover-card group flex min-w-0 flex-col gap-2.5">
	<div class="relative aspect-video overflow-hidden rounded-xl bg-(--bg-subtle)">
		<div class="flex h-full w-full items-center justify-center bg-(--bg-elevated) transition-transform duration-500 group-hover:scale-[1.03]">
			<span class="flex h-12 w-12 items-center justify-center rounded-full bg-(--bg-active) text-(--text-secondary)">
				<Icon name="theater" size={22} />
			</span>
		</div>
		<span class="absolute top-2 left-2 rounded-md bg-(--text) px-1.5 py-0.5 text-[10px] font-bold text-(--bg)">LIVE</span>
		<span class="absolute right-1.5 bottom-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur-sm">
			{formatViews(stream.viewers)}
		</span>
	</div>

	<div class="flex min-w-0 gap-3">
		<Avatar name={stream.name} image={stream.image} id={stream.userId} size={36} />
		<div class="min-w-0 flex-1">
			<h3 class="line-clamp-2 text-[15px] leading-[1.35] font-semibold tracking-[-0.01em] transition-colors group-hover:text-(--text-secondary)">
				{stream.title || 'Прямая трансляция'}
			</h3>
			<p class="mt-1 truncate text-[13px] text-(--text-secondary)">{stream.name}</p>
			<p class="mt-0.5 text-[13px] text-(--text-secondary)">{stream.category} · в эфире</p>
		</div>
	</div>
</a>
