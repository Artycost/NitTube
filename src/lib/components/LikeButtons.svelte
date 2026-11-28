<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toasts } from '#lib/stores/toast.svelte';
	import { formatCompact } from '#lib/utils/format';
	import Icon from './Icon.svelte';

	let {
		videoId,
		likes: initialLikes,
		dislikes: initialDislikes,
		reaction: initialReaction
	}: {
		videoId: string;
		likes: number;
		dislikes: number;
		reaction: number;
	} = $props();

	let likes = $state(initialLikes);
	let dislikes = $state(initialDislikes);
	let reaction = $state(initialReaction);
	let loading = $state(false);

	$effect(() => {
		likes = initialLikes;
		dislikes = initialDislikes;
		reaction = initialReaction;
	});

	async function react(type: 1 | -1) {
		if (!page.data.user) {
			goto(`/login?redirect=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		if (loading) return;
		loading = true;

		const next = reaction === type ? 0 : type;
		const previous = { likes, dislikes, reaction };

		if (reaction === 1) likes = Math.max(0, likes - 1);
		if (reaction === -1) dislikes = Math.max(0, dislikes - 1);
		if (next === 1) likes += 1;
		if (next === -1) dislikes += 1;
		reaction = next;

		try {
			const response = await fetch(`/api/videos/${videoId}/reaction`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type: next })
			});
			if (!response.ok) throw new Error('request failed');
			const data = (await response.json()) as { likes: number; dislikes: number; reaction: number };
			likes = data.likes;
			dislikes = data.dislikes;
			reaction = data.reaction;
		} catch {
			likes = previous.likes;
			dislikes = previous.dislikes;
			reaction = previous.reaction;
			toasts.error('Не удалось поставить оценку');
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex h-9 items-center overflow-hidden rounded-full bg-(--bg-hover)">
	<button
		class="flex h-full items-center gap-2 px-3.5 text-[13px] font-semibold transition hover:bg-(--bg-active)"
		class:text-(--accent)={reaction === 1}
		onclick={() => react(1)}
		aria-label="Нравится"
		aria-pressed={reaction === 1}
	>
		<Icon name="thumbUp" size={18} filled={reaction === 1} />
		<span class="tabular-nums">{formatCompact(likes)}</span>
	</button>
	<div class="h-5 w-px bg-(--border-strong)"></div>
	<button
		class="flex h-full items-center justify-center px-3 text-(--text) transition hover:bg-(--bg-active)"
		class:text-(--accent)={reaction === -1}
		onclick={() => react(-1)}
		aria-label="Не нравится"
		aria-pressed={reaction === -1}
	>
		<Icon name="thumbDown" size={18} filled={reaction === -1} />
	</button>
</div>
