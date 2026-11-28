<script lang="ts">
	let {
		text,
		class: className = ''
	}: {
		text: string;
		class?: string;
	} = $props();

	type Segment = { type: 'text' | 'link' | 'hashtag'; value: string };
	const TOKEN = /https?:\/\/[^\s<>"']+|#[\p{L}\p{N}_]{2,30}/gu;

	function parse(value: string): Segment[] {
		const segments: Segment[] = [];
		let last = 0;
		for (const match of value.matchAll(TOKEN)) {
			const index = match.index ?? 0;
			if (index > last) segments.push({ type: 'text', value: value.slice(last, index) });
			const raw = match[0];
			if (raw.startsWith('http')) {
				const link = raw.replace(/[.,;:!?)\]]+$/, '');
				segments.push({ type: 'link', value: link });
				last = index + link.length;
			} else {
				segments.push({ type: 'hashtag', value: raw });
				last = index + raw.length;
			}
		}
		if (last < value.length) segments.push({ type: 'text', value: value.slice(last) });
		return segments;
	}

	const segments = $derived(parse(text ?? ''));
</script>

<p class="leading-relaxed whitespace-pre-wrap {className}">
	{#each segments as segment, index (index)}
		{#if segment.type === 'text'}
			{segment.value}
		{:else if segment.type === 'link'}
			<a href={segment.value} target="_blank" rel="noopener noreferrer" class="font-medium break-all text-sky-400 hover:underline">
				{segment.value}
			</a>
		{:else}
			<a href="/results?q={encodeURIComponent(segment.value.slice(1))}" class="font-semibold text-sky-400 hover:underline">
				{segment.value}
			</a>
		{/if}
	{/each}
</p>
