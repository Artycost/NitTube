<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toasts } from '#lib/stores/toast.svelte';
	import type { CommentData } from '#lib/types';
	import { formatCompact, timeAgo } from '#lib/utils/format';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import CommentMenu from './CommentMenu.svelte';
	import VerifiedBadge from './VerifiedBadge.svelte';

	let {
		videoId,
		videoOwnerId,
		comments: initialComments,
		count: initialCount
	}: {
		videoId: string;
		videoOwnerId: string;
		comments: CommentData[];
		count: number;
	} = $props();

	let comments = $state<CommentData[]>(initialComments);
	let count = $state(initialCount);
	let sortMode = $state<'new' | 'top'>('new');
	let text = $state('');
	let posting = $state(false);
	let replyTo = $state<string | null>(null);
	let replyText = $state('');
	let replyPosting = $state(false);
	let confirmDelete = $state<string | null>(null);
	let composer = $state<HTMLTextAreaElement>();
	let expandedReplies = $state<string[]>([]);
	let disliked = $state<Record<string, boolean>>({});

	const user = $derived(page.data.user);

	$effect(() => {
		comments = initialComments;
		count = initialCount;
	});

	const sorted = $derived(
		[...comments].sort((a, b) =>
			sortMode === 'top'
				? b.likeCount - a.likeCount
				: new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		)
	);

	function requireAuth() {
		if (!user) {
			goto(`/login?redirect=${encodeURIComponent(page.url.pathname)}`);
			return false;
		}
		return true;
	}

	async function submitComment() {
		if (!requireAuth()) return;
		const content = text.trim();
		if (!content || posting) return;

		posting = true;
		try {
			const response = await fetch(`/api/videos/${videoId}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ content })
			});
			if (!response.ok) throw new Error('failed');
			const created = (await response.json()) as CommentData;
			comments = [created, ...comments];
			count += 1;
			text = '';
			if (composer) composer.style.height = 'auto';
			toasts.success('Комментарий добавлен');
		} catch {
			toasts.error('Не удалось отправить комментарий');
		} finally {
			posting = false;
		}
	}

	async function submitReply(parentId: string) {
		if (!requireAuth()) return;
		const content = replyText.trim();
		if (!content || replyPosting) return;

		replyPosting = true;
		try {
			const response = await fetch(`/api/videos/${videoId}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ content, parentId })
			});
			if (!response.ok) throw new Error('failed');
			const created = (await response.json()) as CommentData;
			comments = comments.map((comment) =>
				comment.id === parentId ? { ...comment, replies: [...comment.replies, created] } : comment
			);
			count += 1;
			replyText = '';
			replyTo = null;
		} catch {
			toasts.error('Не удалось отправить ответ');
		} finally {
			replyPosting = false;
		}
	}

	async function likeComment(comment: CommentData) {
		if (!requireAuth()) return;

		const liked = !comment.likedByMe;
		const apply = (value: boolean) => {
			comments = comments.map((item) => {
				if (item.id === comment.id) {
					return { ...item, likedByMe: value, likeCount: Math.max(0, item.likeCount + (value ? 1 : -1)) };
				}
				return {
					...item,
					replies: item.replies.map((reply) =>
						reply.id === comment.id
							? { ...reply, likedByMe: value, likeCount: Math.max(0, reply.likeCount + (value ? 1 : -1)) }
							: reply
					)
				};
			});
		};

		apply(liked);

		try {
			const response = await fetch(`/api/comments/${comment.id}/reaction`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ liked })
			});
			if (!response.ok) throw new Error('failed');
			const data = (await response.json()) as { liked: boolean; count: number };
			comments = comments.map((item) => {
				if (item.id === comment.id) return { ...item, likedByMe: data.liked, likeCount: data.count };
				return {
					...item,
					replies: item.replies.map((reply) =>
						reply.id === comment.id ? { ...reply, likedByMe: data.liked, likeCount: data.count } : reply
					)
				};
			});
		} catch {
			apply(!liked);
			toasts.error('Не удалось поставить отметку');
		}
	}

	async function removeComment(comment: CommentData) {
		try {
			const response = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('failed');
			comments = comments.filter((item) => item.id !== comment.id);
			count = Math.max(0, count - 1 - comment.replies.length);
			confirmDelete = null;
			toasts.success('Комментарий удалён');
		} catch {
			toasts.error('Не удалось удалить комментарий');
		}
	}

	async function refresh() {
		const res = await fetch(`/api/videos/${videoId}/comments`);
		if (res.ok) {
			const data = await res.json();
			comments = data.comments;
			count = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
		}
	}

	function autoGrow(event: Event) {
		const el = event.currentTarget as HTMLTextAreaElement;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}
</script>

<section class="mt-8">
	<div class="mb-5 flex flex-wrap items-center gap-4">
		<h2 class="font-display text-lg font-bold tracking-tight">
			{formatCompact(count)}
			{count % 10 === 1 && count % 100 !== 11 ? 'комментарий' : 'комментариев'}
		</h2>
		<div class="flex items-center gap-1">
			<button
				class="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition {sortMode === 'new' ? 'bg-(--bg-hover)' : 'text-(--text-secondary) hover:bg-(--bg-hover)'}"
				onclick={() => (sortMode = 'new')}
			>
				<Icon name="sort" size={15} />
				Новые
			</button>
			<button
				class="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition {sortMode === 'top' ? 'bg-(--bg-hover)' : 'text-(--text-secondary) hover:bg-(--bg-hover)'}"
				onclick={() => (sortMode = 'top')}
			>
				<Icon name="thumbUp" size={15} />
				Популярные
			</button>
		</div>
	</div>

	{#if user}
		<div class="mb-7 flex gap-3">
			<Avatar name={user.name} image={user.image} id={user.id} size={38} />
			<div class="min-w-0 flex-1">
				<textarea
					bind:this={composer}
					bind:value={text}
					oninput={autoGrow}
					onkeydown={(event) => {
						if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submitComment();
					}}
					rows="1"
					placeholder="Добавьте комментарий…"
					class="w-full resize-none border-b border-(--border) bg-transparent pb-2 text-sm outline-none transition-colors placeholder:text-(--text-tertiary) focus:border-(--text)"
				></textarea>
				<div class="mt-2 flex items-center justify-between">
					<p class="text-[11px] text-(--text-tertiary)">Ctrl + Enter — отправить</p>
					<div class="flex items-center gap-2">
						{#if text}
							<button class="btn-secondary h-8 px-3 text-xs" onclick={() => { text = ''; if (composer) composer.style.height = 'auto'; }}>
								Отмена
							</button>
						{/if}
						<button
							class="btn-primary h-8 px-4 text-xs"
							disabled={!text.trim() || posting}
							onclick={submitComment}
						>
							{posting ? 'Отправка…' : 'Отправить'}
						</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--border) bg-(--bg-subtle) px-4 py-3.5">
			<p class="text-sm text-(--text-secondary)">Войдите, чтобы оставить комментарий</p>
			<a href="/login?redirect={encodeURIComponent(page.url.pathname)}" class="btn-primary h-8 px-4 text-xs">
				Войти
			</a>
		</div>
	{/if}

	{#if sorted.length === 0}
		<div class="flex flex-col items-center gap-2 py-10 text-center">
			<Icon name="message" size={28} class="text-(--text-tertiary)" />
			<p class="text-sm text-(--text-secondary)">Комментариев пока нет. Будьте первым!</p>
		</div>
	{:else}
		<div class="flex flex-col gap-6">
			{#each sorted as comment (comment.id)}
				<div class="flex gap-3">
					<a href="/channel/{comment.user.id}" class="mt-0.5 shrink-0">
						<Avatar name={comment.user.name} image={comment.user.image} id={comment.user.id} size={38} />
					</a>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
							<a href="/channel/{comment.user.id}" class="text-[13px] font-bold hover:text-(--text)">
								@{comment.user.name.toLowerCase().replace(/\s+/g, '')}
							</a>
							{#if comment.user.verified}
								<VerifiedBadge size={13} />
							{/if}
							{#if comment.user.creator}
								<span class="rounded-[6px] bg-(--bg-subtle) px-1.5 py-0.5 text-[10px] font-bold">Создатель</span>
							{/if}
							{#if comment.user.id === videoOwnerId}
								<span class="rounded-[6px] bg-(--text) px-1.5 py-0.5 text-[10px] font-bold text-(--bg)">Автор</span>
							{/if}
							{#if comment.pinned}
								<span class="rounded-[6px] bg-(--bg-subtle) px-1.5 py-0.5 text-[10px] font-bold">Закреплён</span>
							{/if}
							<span class="text-[11px] text-(--text-tertiary)">{timeAgo(comment.createdAt)}</span>
							<div class="ml-auto">
								<CommentMenu
									commentId={comment.id}
									authorId={comment.user.id}
									ownerId={videoOwnerId}
									currentUserId={page.data.user?.id}
									pinned={comment.pinned}
									onupdate={refresh}
								/>
							</div>
						</div>
						<p class="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">{comment.content}</p>

						<div class="mt-1.5 flex items-center gap-1">
							<button
								class="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-(--text-secondary) transition hover:bg-(--bg-hover) hover:text-(--text)"
								class:text-(--accent)={comment.likedByMe}
								onclick={() => likeComment(comment)}
							>
								<Icon name="thumbUp" size={15} filled={comment.likedByMe} />
								{#if comment.likeCount > 0}<span class="tabular-nums">{formatCompact(comment.likeCount)}</span>{/if}
							</button>
							<button
								class="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-(--text-secondary) transition hover:bg-(--bg-hover) hover:text-(--text)"
								class:text-(--accent)={disliked[comment.id]}
								onclick={() => {
									disliked = { ...disliked, [comment.id]: !disliked[comment.id] };
									if (disliked[comment.id] && comment.likedByMe) likeComment(comment);
									toasts.success('Спасибо за оценку');
								}}
								aria-label="Не нравится"
							>
								<Icon name="thumbDown" size={15} filled={!!disliked[comment.id]} />
							</button>
							{#if user}
								<button
									class="h-8 rounded-full px-2.5 text-xs font-medium text-(--text-secondary) transition hover:bg-(--bg-hover) hover:text-(--text)"
									onclick={() => {
										replyTo = replyTo === comment.id ? null : comment.id;
										replyText = '';
									}}
								>
									Ответить
								</button>
							{/if}
							{#if user?.id === comment.user.id || user?.id === videoOwnerId}
								{#if confirmDelete === comment.id}
									<span class="flex items-center gap-1 text-xs">
										<span class="text-(--text-secondary)">Удалить?</span>
										<button class="rounded-full px-2 py-1 font-semibold text-red-500 hover:bg-red-500/10" onclick={() => removeComment(comment)}>
											Да
										</button>
										<button class="rounded-full px-2 py-1 text-(--text-secondary) hover:bg-(--bg-hover)" onclick={() => (confirmDelete = null)}>
											Нет
										</button>
									</span>
								{:else}
									<button
										class="flex h-8 w-8 items-center justify-center rounded-full text-(--text-tertiary) transition hover:bg-(--bg-hover) hover:text-(--text)"
										onclick={() => (confirmDelete = comment.id)}
										aria-label="Удалить комментарий"
									>
										<Icon name="trash" size={15} />
									</button>
								{/if}
							{/if}
						</div>

						{#if replyTo === comment.id}
							<div class="mt-2 flex gap-2.5">
								<Avatar name={user?.name ?? ''} image={user?.image} id={user?.id} size={30} />
								<div class="min-w-0 flex-1">
									<textarea
										bind:value={replyText}
										rows="1"
										placeholder="Ответить {comment.user.name}…"
										class="w-full resize-none border-b border-(--border) bg-transparent pb-1.5 text-[13px] outline-none placeholder:text-(--text-tertiary) focus:border-(--text)"
									></textarea>
									<div class="mt-1.5 flex justify-end gap-2">
										<button class="btn-secondary h-7 px-2.5 text-xs" onclick={() => { replyTo = null; replyText = ''; }}>Отмена</button>
										<button
											class="btn-primary h-7 px-3 text-xs"
											disabled={!replyText.trim() || replyPosting}
											onclick={() => submitReply(comment.id)}
										>
											{replyPosting ? '…' : 'Ответить'}
										</button>
									</div>
								</div>
							</div>
						{/if}

						{#if comment.replies.length > 0}
							<button
								class="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)"
								onclick={() => {
									expandedReplies = expandedReplies.includes(comment.id)
										? expandedReplies.filter((id) => id !== comment.id)
										: [...expandedReplies, comment.id];
								}}
							>
								<Icon name={expandedReplies.includes(comment.id) ? 'chevronUp' : 'chevronDown'} size={15} />
								{comment.replies.length} ответов
							</button>
						{/if}
						{#if comment.replies.length > 0 && expandedReplies.includes(comment.id)}
							<div class="mt-3 flex flex-col gap-4 border-l border-(--border) pl-4">
								{#each comment.replies as reply (reply.id)}
									<div class="flex gap-2.5">
										<a href="/channel/{reply.user.id}" class="mt-0.5 shrink-0">
											<Avatar name={reply.user.name} image={reply.user.image} id={reply.user.id} size={30} />
										</a>
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
												<a href="/channel/{reply.user.id}" class="text-[12.5px] font-bold hover:text-(--text)">
													@{reply.user.name.toLowerCase().replace(/\s+/g, '')}
												</a>
												{#if reply.user.verified}
													<VerifiedBadge size={12} />
												{/if}
												<span class="text-[11px] text-(--text-tertiary)">{timeAgo(reply.createdAt)}</span>
											</div>
											<p class="mt-0.5 text-[13px] leading-relaxed whitespace-pre-wrap">{reply.content}</p>
											<button
												class="mt-1 flex h-7 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium text-(--text-secondary) transition hover:bg-(--bg-hover)"
												class:text-(--accent)={reply.likedByMe}
												onclick={() => likeComment(reply)}
											>
												<Icon name="thumbUp" size={13} filled={reply.likedByMe} />
												{#if reply.likeCount > 0}<span class="tabular-nums">{formatCompact(reply.likeCount)}</span>{/if}
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
