<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatCompact, formatDateShort, formatDuration, formatViews, timeAgo } from '#lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const a = $derived(data.analytics);
	const tab = $derived(data.tab);
	let deleting = $state<string | null>(null);

	async function deleteVideo(id: string) {
		if (!confirm('Удалить видео? Это действие нельзя отменить.')) return;
		deleting = id;
		const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
		deleting = null;
		if (res.ok) await invalidateAll();
	}

	let range = $state(28);
	let contentFilter = $state<'all' | 'video' | 'short'>('all');

	const tabs = [
		{ id: 'overview', label: 'Обзор', icon: 'home' },
		{ id: 'content', label: 'Контент', icon: 'film' },
		{ id: 'reach', label: 'Охват', icon: 'eye' },
		{ id: 'engagement', label: 'Вовлечённость', icon: 'heart' },
		{ id: 'audience', label: 'Аудитория', icon: 'users' }
	] as const;

	const ranges = [
		{ value: 7, label: '7 дней' },
		{ value: 28, label: '28 дней' },
		{ value: 90, label: '90 дней' },
		{ value: 0, label: 'Всё время' }
	] as const;

	const series = $derived(range === 0 ? a.daily : a.daily.slice(-range));
	const maxViews = $derived(Math.max(1, ...series.map((d) => d.views)));
	const points = $derived(
		series.map((d, i) => ({
			...d,
			x: series.length > 1 ? (i / (series.length - 1)) * 800 : 400,
			y: 190 - (d.views / maxViews) * 155
		}))
	);
	const linePath = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
	const areaPath = $derived(`${linePath} L800,190 L0,190 Z`);
	const totalRangeViews = $derived(series.reduce((sum, d) => sum + d.views, 0));
	const topVideoMax = $derived(Math.max(1, ...a.topVideos.map((v) => v.views)));
	const filteredVideos = $derived(
		contentFilter === 'all'
			? a.topVideos
			: a.topVideos.filter((v) => (contentFilter === 'short' ? v.duration < 60 : v.duration >= 60))
	);

	const cards = $derived([
		{ label: 'Просмотры', value: formatCompact(a.views), icon: 'eye', hint: `${a.watchSessions} сеансов` },
		{ label: 'Подписчики', value: formatCompact(a.subscribers), icon: 'users', hint: 'на канале' },
		{ label: 'Лайки', value: formatCompact(a.likes), icon: 'thumbUp', hint: `${a.dislikes} дизлайков` },
		{ label: 'Комментарии', value: formatCompact(a.comments), icon: 'message', hint: 'от зрителей' }
	]);
</script>

<svelte:head>
	<title>Панель управления каналом — VueTube</title>
</svelte:head>

<div class="mx-auto max-w-[1400px] px-4 pt-7 pb-24 sm:px-6 2xl:max-w-[1700px] fade-in">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="mb-1 text-[11px] font-bold tracking-wide text-(--text-tertiary) uppercase">Студия</p>
			<h1 class="font-display text-[28px] leading-tight font-extrabold tracking-[-0.03em] 2xl:text-[32px]">
				Панель управления каналом
			</h1>
			<p class="mt-1 text-[13px] text-(--text-secondary)">Всё о вашем канале в одном месте</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<div class="flex items-center gap-2 rounded-[13px] bg-(--bg-elevated) p-1">
				{#each ranges as r (r.value)}
					<button
						type="button"
						class="rounded-[10px] px-3.5 py-2 text-[12px] font-semibold transition duration-200 {range === r.value
							? 'bg-(--bg-active) text-(--text)'
							: 'text-(--text-tertiary) hover:text-(--text)'}"
						onclick={() => (range = r.value)}
					>
						{r.label}
					</button>
				{/each}
			</div>
			<a href="/upload" class="icon-btn" aria-label="Загрузить видео" title="Загрузить видео">
				<Icon name="upload" size={19} />
			</a>
			<a href="/settings" class="icon-btn" aria-label="Настроить канал" title="Настроить канал">
				<Icon name="settings" size={19} />
			</a>
		</div>
	</div>

	<div class="tabs-scroll no-scrollbar mb-6 flex gap-1 overflow-x-auto rounded-[14px] bg-(--bg-elevated) p-1">
		{#each tabs as t (t.id)}
			<a href="/analytics?tab={t.id}" class="tab-button {tab === t.id ? 'tab-active' : ''}">
				<Icon name={t.icon} size={16} />
				{t.label}
			</a>
		{/each}
	</div>

	{#if tab === 'overview'}
		<div class="dashboard-grid">
			<section class="studio-card card-violations">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-[16px] font-bold">Нарушения</h2>
					<span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--bg-subtle)">
						<Icon name="check" size={17} />
					</span>
				</div>
				<p class="text-[13px] leading-relaxed text-(--text-secondary)">
					Действительные предупреждения о нарушениях сообщества
				</p>
				<span class="mt-5 inline-flex items-center gap-1.5 rounded-[9px] bg-(--bg-subtle) px-3 py-1.5 text-[11px] font-semibold text-(--text-secondary)">
					<Icon name="check" size={13} />
					Нарушений нет
				</span>
			</section>

			<section class="studio-card card-channel">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-[16px] font-bold">Аналитика по каналу</h2>
					<a href="/analytics?tab=reach" class="text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)">
						Подробнее →
					</a>
				</div>
				<p class="text-[12px] text-(--text-tertiary)">Подписчики</p>
				<p class="font-display mt-1 text-[36px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
					{formatCompact(a.subscribers)}
				</p>
				<div class="hairline my-5"></div>
				<p class="mb-3 text-[12px] font-semibold text-(--text-tertiary)">Сводные данные за 28 дней</p>
				<div class="flex flex-col gap-3 text-[13px]">
					<div class="flex items-center justify-between"><span class="text-(--text-secondary)">Просмотры</span><strong class="tabular-nums">{formatCompact(a.views)}</strong></div>
					<div class="flex items-center justify-between"><span class="text-(--text-secondary)">Время просмотра</span><strong class="tabular-nums">{formatDuration(a.watchTime)}</strong></div>
				</div>
				<div class="hairline my-5"></div>
				<p class="mb-3 text-[12px] font-semibold text-(--text-tertiary)">Самый популярный контент</p>
				{#if a.topVideos.length > 0}
					<div class="flex flex-col gap-3">
						{#each a.topVideos.slice(0, 3) as video (video.id)}
							<a href="/watch/{video.id}" class="flex items-center gap-3 rounded-[12px] bg-(--bg-subtle) p-2 transition hover:bg-(--bg-hover)">
								{#if video.thumbnail}<img src={video.thumbnail} alt="" class="h-10 w-16 shrink-0 rounded-[7px] object-cover" />{:else}<span class="h-10 w-16 shrink-0 rounded-[7px] bg-(--bg-active)"></span>{/if}
								<span class="min-w-0 flex-1 truncate text-[12px] font-medium">{video.title}</span>
								<span class="shrink-0 text-[12px] font-bold tabular-nums">{formatCompact(video.views)}</span>
							</a>
						{/each}
					</div>
				{:else}
					<p class="text-[13px] text-(--text-tertiary)">Пока нет контента</p>
				{/if}
				<a href="/analytics?tab=reach" class="btn-secondary mt-5 h-9 w-full text-[12px]">Перейти к статистике канала</a>
			</section>

			<section class="studio-card card-ideas">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-[16px] font-bold">Идеи для вас</h2>
					<span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--bg-subtle)"><Icon name="sparkles" size={17} /></span>
				</div>
				<p class="text-[13px] font-semibold">Продолжайте публиковать видео</p>
				<p class="mt-2 text-[13px] leading-relaxed text-(--text-secondary)">
					Регулярные загрузки помогают аудитории возвращаться на ваш канал. Начните с Shorts или полного видео.
				</p>
				<a href="/upload" class="btn-secondary mt-5 h-9 w-full text-[12px]">
					<Icon name="upload" size={15} />
					Создать видео
				</a>
			</section>

			<section class="studio-card card-performance">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-[16px] font-bold">Эффективность видео</h2>
					<a href="/analytics?tab=content" class="text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)">Все видео →</a>
				</div>
				{#if a.topVideos.length > 0}
					{@const lead = a.topVideos[0]}
					<div class="flex gap-3">
						{#if lead.thumbnail}<img src={lead.thumbnail} alt="" class="h-[86px] w-[140px] shrink-0 rounded-[10px] object-cover" />{:else}<span class="h-[86px] w-[140px] shrink-0 rounded-[10px] bg-(--bg-subtle)"></span>{/if}
						<div class="min-w-0">
							<p class="line-clamp-2 text-[13px] font-semibold">{lead.title}</p>
							<div class="mt-2 flex flex-wrap gap-3 text-[11px] text-(--text-secondary)">
								<span class="inline-flex items-center gap-1"><Icon name="eye" size={13} />{formatCompact(lead.views)}</span>
								<span class="inline-flex items-center gap-1"><Icon name="message" size={13} />{formatCompact(lead.comments)}</span>
								<span class="inline-flex items-center gap-1"><Icon name="thumbUp" size={13} />{formatCompact(lead.likes)}</span>
							</div>
						</div>
					</div>
					<a href="/analytics?tab=engagement" class="btn-secondary mt-4 h-9 w-full text-[12px]">Анализ результатов этого видео</a>
				{:else}
					<p class="text-[13px] text-(--text-tertiary)">Загрузите видео, чтобы увидеть эффективность</p>
				{/if}
			</section>

			<section class="studio-card card-news">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-[16px] font-bold">Новости</h2>
					<span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--bg-subtle)"><Icon name="bell" size={17} /></span>
				</div>
				<p class="text-[13px] font-semibold">Ваш канал на VueTube</p>
				<p class="mt-2 text-[13px] leading-relaxed text-(--text-secondary)">
					Здесь появятся обновления платформы, советы авторам и важные уведомления.
				</p>
				<span class="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-(--text-tertiary)">
					<Icon name="info" size={14} />
					Обновления для авторов
				</span>
			</section>

			<section class="studio-card card-comments">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-[16px] font-bold">Комментарии</h2>
					<a href="/analytics?tab=engagement" class="text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)">Все →</a>
				</div>
				{#if a.recentComments.length > 0}
					<div class="flex flex-col gap-3">
						{#each a.recentComments as comment (comment.id)}
							<a href="/watch/{comment.videoId}" class="flex gap-3 rounded-[12px] p-1 transition hover:bg-(--bg-subtle)">
								<Avatar name={comment.author} image={comment.image} id={comment.author} size={32} />
								<div class="min-w-0">
									<p class="flex items-center gap-2 text-[12px]"><strong class="truncate">{comment.author}</strong><span class="text-(--text-tertiary)">{timeAgo(comment.createdAt)}</span></p>
									<p class="mt-0.5 line-clamp-2 text-[12px] text-(--text-secondary)">{comment.content}</p>
									<p class="mt-1 truncate text-[11px] text-(--text-tertiary)">к видео «{comment.videoTitle}»</p>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<p class="text-[13px] text-(--text-tertiary)">Комментариев пока нет</p>
				{/if}
			</section>

			<section class="studio-card card-published">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-display text-[16px] font-bold">Опубликованные видео</h2>
					<a href="/analytics?tab=content" class="text-[12px] font-semibold text-(--text-secondary) transition hover:text-(--text)">Перейти к видео →</a>
				</div>
				{#if a.topVideos.length > 0}
					<div class="flex flex-col gap-2">
						{#each a.topVideos.slice(0, 4) as video (video.id)}
							<a href="/watch/{video.id}" class="flex items-center gap-3 rounded-[12px] p-1 transition hover:bg-(--bg-subtle)">
								{#if video.thumbnail}<img src={video.thumbnail} alt="" class="h-10 w-16 shrink-0 rounded-[7px] object-cover" />{:else}<span class="h-10 w-16 shrink-0 rounded-[7px] bg-(--bg-active)"></span>{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-[12px] font-medium">{video.title}</p>
									<p class="mt-0.5 text-[11px] text-(--text-tertiary)">{formatDuration(video.duration)} · {formatCompact(video.views)} просмотров</p>
								</div>
								<Icon name="chevronRight" size={15} class="text-(--text-tertiary)" />
							</a>
						{/each}
					</div>
				{:else}
					<p class="text-[13px] text-(--text-tertiary)">Нет опубликованных видео</p>
				{/if}
			</section>
		</div>
	{:else if tab === 'content'}
		<section class="studio-card !p-0">
			<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
				<div>
					<h2 class="font-display text-[17px] font-bold">Контент на канале</h2>
					<p class="mt-1 text-[12px] text-(--text-tertiary)">{a.videoCount} видео</p>
				</div>
				<div class="flex gap-1 rounded-[12px] bg-(--bg-subtle) p-1">
					{#each [{ id: 'all', label: 'Все' }, { id: 'video', label: 'Видео' }, { id: 'short', label: 'Shorts' }] as f (f.id)}
						<button
							type="button"
							class="rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition {contentFilter === f.id ? 'bg-(--bg-active) text-(--text)' : 'text-(--text-tertiary) hover:text-(--text)'}"
							onclick={() => (contentFilter = f.id as typeof contentFilter)}
						>
							{f.label}
						</button>
					{/each}
				</div>
			</div>
			{#if filteredVideos.length > 0}
				<div class="overflow-x-auto no-scrollbar">
					<table class="w-full min-w-[640px] text-left text-[13px]">
						<thead>
							<tr class="border-y border-(--border) text-[11px] font-semibold tracking-wide text-(--text-tertiary) uppercase">
								<th class="px-5 py-3 font-semibold sm:px-6">Видео</th>
								<th class="px-3 py-3 text-right font-semibold">Просмотры</th>
								<th class="px-3 py-3 text-right font-semibold">Лайки</th>
								<th class="px-3 py-3 text-right font-semibold">Комментарии</th>
								<th class="px-5 py-3 text-right font-semibold sm:px-6">Дата</th>
								<th class="px-3 py-3 text-right font-semibold">Действия</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredVideos as video (video.id)}
								<tr class="border-b border-(--border) transition-colors duration-200 last:border-0 hover:bg-(--bg-subtle)">
									<td class="px-5 py-3.5 sm:px-6">
										<a href="/watch/{video.id}" class="flex items-center gap-3">
											{#if video.thumbnail}<img src={video.thumbnail} alt="" class="h-11 w-18 shrink-0 rounded-[8px] object-cover" />{:else}<span class="flex h-11 w-18 shrink-0 items-center justify-center rounded-[8px] bg-(--bg-subtle)"><Icon name="play" size={15} /></span>{/if}
											<span class="min-w-0">
												<span class="block max-w-[320px] truncate font-semibold">{video.title}</span>
												<span class="mt-0.5 block text-[11px] text-(--text-tertiary)">{formatDuration(video.duration)} · {video.quality ?? 'авто'}</span>
											</span>
										</a>
									</td>
									<td class="px-3 py-3.5 text-right font-semibold tabular-nums">{formatCompact(video.views)}</td>
									<td class="px-3 py-3.5 text-right tabular-nums text-(--text-secondary)">{formatCompact(video.likes)}</td>
									<td class="px-3 py-3.5 text-right tabular-nums text-(--text-secondary)">{formatCompact(video.comments)}</td>
									<td class="px-5 py-3.5 text-right whitespace-nowrap text-(--text-tertiary) sm:px-6">{formatDateShort(video.createdAt)}</td>
									<td class="px-3 py-3.5">
										<div class="flex items-center justify-end gap-1">
											<a href="/edit/{video.id}" class="action-btn" title="Изменить"><Icon name="edit" size={15} /></a>
											<a href={video.videoUrl} download class="action-btn" title="Скачать"><Icon name="download" size={15} /></a>
											<button class="action-btn" onclick={() => deleteVideo(video.id)} disabled={deleting === video.id} title="Удалить"><Icon name="trash" size={15} /></button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="px-5 py-12 text-center text-[13px] text-(--text-tertiary) sm:px-6">Нет видео в этой категории</p>
			{/if}
		</section>
	{:else if tab === 'reach'}
		<div class="stats-grid">
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Просмотры</span><p class="stat-value">{formatCompact(a.views)}</p><p class="stat-hint">всего на канале</p></div>
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Уникальные зрители</span><p class="stat-value">{formatCompact(a.uniqueViewers)}</p><p class="stat-hint">посмотрели хотя бы одно видео</p></div>
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Подписчики</span><p class="stat-value">{formatCompact(a.subscribers)}</p><p class="stat-hint">текущая аудитория</p></div>
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Среднее на видео</span><p class="stat-value">{a.videoCount ? formatCompact(Math.round(a.views / a.videoCount)) : '0'}</p><p class="stat-hint">просмотров на публикацию</p></div>
		</div>
		<section class="studio-card mt-5">
			<div class="mb-5 flex items-start justify-between gap-3">
				<div><h2 class="font-display text-[17px] font-bold">Охват за период</h2><p class="mt-1 text-[12px] text-(--text-tertiary)">Просмотры по дням</p></div>
				<span class="rounded-[10px] bg-(--bg-subtle) px-3 py-1.5 text-[12px] font-semibold text-(--text-secondary)">{formatCompact(totalRangeViews)}</span>
			</div>
			{#if totalRangeViews > 0}
				<svg viewBox="0 0 800 200" preserveAspectRatio="none" class="chart-svg" role="img" aria-label="График охвата">
					{#each [30, 80, 130, 190] as y}<line x1="0" y1={y} x2="800" y2={y} stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="4 6" />{/each}
					<path d={areaPath} fill="var(--text)" opacity="0.07" />
					<path d={linePath} fill="none" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
				</svg>
			{:else}
				<div class="flex h-[200px] items-center justify-center text-[13px] text-(--text-tertiary)">Нет данных за период</div>
			{/if}
		</section>
		<section class="studio-card mt-5">
			<h2 class="font-display text-[17px] font-bold">Охват по видео</h2>
			<div class="mt-6 flex flex-col gap-5">
				{#each a.topVideos as video, i (video.id)}
					<div>
						<div class="mb-2 flex items-baseline justify-between gap-3"><span class="min-w-0 truncate text-[13px] font-medium">{String(i + 1).padStart(2, '0')} {video.title}</span><span class="shrink-0 text-[12px] font-semibold tabular-nums text-(--text-secondary)">{formatCompact(video.views)}</span></div>
						<div class="h-2 overflow-hidden rounded-full bg-(--bg-subtle)"><div class="bar h-full rounded-full bg-(--text-secondary)" style="width:{(video.views / topVideoMax) * 100}%"></div></div>
					</div>
				{/each}
			</div>
		</section>
	{:else if tab === 'engagement'}
		<div class="stats-grid">
			{#each cards as card (card.label)}
				<div class="stat-card">
					<div class="flex items-start justify-between"><span class="text-[13px] font-medium text-(--text-secondary)">{card.label}</span><span class="flex h-9 w-9 items-center justify-center rounded-[11px] bg-(--bg-subtle)"><Icon name={card.icon} size={18} /></span></div>
					<p class="font-display mt-4 text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{card.value}</p>
					<p class="mt-2 text-[12px] text-(--text-tertiary)">{card.hint}</p>
				</div>
			{/each}
		</div>
		<div class="mt-5 grid gap-5 lg:grid-cols-2">
			<section class="studio-card">
				<h2 class="font-display text-[17px] font-bold">Удержание аудитории</h2>
				<div class="mt-7 flex flex-col gap-6">
					<div><div class="mb-2 flex justify-between text-[13px]"><span class="text-(--text-secondary)">Досмотрено</span><span class="font-bold tabular-nums">{a.avgPercent}%</span></div><div class="h-2 rounded-full bg-(--bg-subtle)"><div class="bar h-full rounded-full bg-(--text)" style="width:{a.avgPercent}%"></div></div></div>
					<div><div class="mb-2 flex justify-between text-[13px]"><span class="text-(--text-secondary)">Лайк / просмотр</span><span class="font-bold tabular-nums">{a.likeRatio}%</span></div><div class="h-2 rounded-full bg-(--bg-subtle)"><div class="bar h-full rounded-full bg-(--text-secondary)" style="width:{Math.min(100, a.likeRatio * 4)}%"></div></div></div>
				</div>
				<div class="mt-7 grid grid-cols-2 gap-3 border-t border-(--border) pt-6">
					<div class="mini-box"><span>Сеансов</span><strong>{formatCompact(a.watchSessions)}</strong></div>
					<div class="mini-box"><span>Завершено</span><strong>{formatCompact(a.completed)}</strong></div>
					<div class="mini-box"><span>Реакций</span><strong>{formatCompact(a.reactionLikes + a.reactionDislikes)}</strong></div>
					<div class="mini-box"><span>Ответов</span><strong>{formatCompact(a.commentCount)}</strong></div>
				</div>
			</section>
			<section class="studio-card">
				<h2 class="font-display text-[17px] font-bold">Самые популярные</h2>
				<div class="mt-6 flex flex-col gap-4">
					{#each a.topLiked as video (video.id)}
						<a href="/watch/{video.id}" class="flex items-center gap-3 rounded-[13px] bg-(--bg-subtle) p-2.5 transition hover:bg-(--bg-hover)">
							{#if video.thumbnail}<img src={video.thumbnail} alt="" class="h-11 w-[72px] rounded-[8px] object-cover" />{:else}<span class="h-11 w-[72px] rounded-[8px] bg-(--bg-active)"></span>{/if}
							<span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-semibold">{video.title}</span><span class="mt-0.5 block text-[11px] text-(--text-tertiary)">{formatViews(video.views)}</span></span>
							<span class="shrink-0 text-[12px] font-bold tabular-nums">{formatCompact(video.likes)}</span>
						</a>
					{/each}
				</div>
			</section>
		</div>
	{:else}
		<div class="stats-grid">
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Подписчики</span><p class="stat-value">{formatCompact(a.subscribers)}</p><p class="stat-hint">всего на канале</p></div>
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Зрители</span><p class="stat-value">{formatCompact(a.uniqueViewers)}</p><p class="stat-hint">уникальных зрителей</p></div>
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Вовлечённость</span><p class="stat-value">{a.avgPercent}%</p><p class="stat-hint">средний просмотр</p></div>
			<div class="stat-card"><span class="text-[13px] text-(--text-secondary)">Просмотры на зрителя</span><p class="stat-value">{a.uniqueViewers ? (a.views / a.uniqueViewers).toFixed(1) : '0'}</p><p class="stat-hint">в среднем</p></div>
		</div>
		<div class="mt-5 grid gap-5 lg:grid-cols-2">
			<section class="studio-card">
				<h2 class="font-display text-[17px] font-bold">Новые подписчики</h2>
				{#if a.recentSubscribers.length > 0}
					<div class="mt-6 flex flex-col gap-2">
						{#each a.recentSubscribers as sub (sub.id)}
							<div class="flex items-center gap-3 rounded-[13px] bg-(--bg-subtle) p-3">
								<Avatar name={sub.name} image={sub.image} id={sub.id} size={38} />
								<div class="min-w-0 flex-1"><p class="truncate text-[13px] font-semibold">{sub.name}</p><p class="text-[11px] text-(--text-tertiary)">{formatDateShort(sub.createdAt)}</p></div>
								<Icon name="check" size={16} class="text-(--text-tertiary)" />
							</div>
						{/each}
					</div>
				{:else}
					<p class="mt-6 text-[13px] text-(--text-tertiary)">Пока нет новых подписчиков</p>
				{/if}
			</section>
			<section class="studio-card">
				<h2 class="font-display text-[17px] font-bold">Портрет аудитории</h2>
				<div class="mt-6 flex flex-col gap-6">
					<div><div class="mb-2 flex justify-between text-[13px]"><span class="text-(--text-secondary)">Новые зрители</span><span class="font-bold tabular-nums">{a.uniqueViewers}</span></div><div class="h-2 rounded-full bg-(--bg-subtle)"><div class="bar h-full rounded-full bg-(--text-secondary)" style="width:100%"></div></div></div>
					<div><div class="mb-2 flex justify-between text-[13px]"><span class="text-(--text-secondary)">Вернулись досматривать</span><span class="font-bold tabular-nums">{a.completed}</span></div><div class="h-2 rounded-full bg-(--bg-subtle)"><div class="bar h-full rounded-full bg-(--text)" style="width:{a.watchSessions ? Math.min(100, Math.round(a.completed * 100 / a.watchSessions)) : 0}%"></div></div></div>
				</div>
			</section>
		</div>
	{/if}
</div>

<style>
	.stats-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.stat-card, .studio-card { background: var(--bg-elevated); border-radius: 22px; padding: 20px; transition: background-color .2s ease, transform .2s ease; }
	.stat-card:hover { background: var(--bg-subtle); transform: translateY(-2px); }
	.stat-value { font-family: var(--font-display); margin-top: 16px; font-size: 30px; line-height: 1; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
	.stat-hint { margin-top: 8px; font-size: 12px; color: var(--text-tertiary); }
	.dashboard-grid { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); align-items: start; }
	.chart-svg { display: block; width: 100%; height: 200px; overflow: visible; }
	.bar { transition: width .8s cubic-bezier(.16,1,.3,1); }
	.tab-button { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600; color: var(--text-secondary); transition: background-color .2s ease, color .2s ease; }
	.tab-button:hover { color: var(--text); }
	.tab-active { background: var(--bg-active); color: var(--text); }
	.mini-box { background: var(--bg-subtle); border-radius: 14px; padding: 16px; }
	.mini-box span { display: block; font-size: 12px; color: var(--text-tertiary); }
	.mini-box strong { display: block; margin-top: 6px; font-family: var(--font-display); font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
	.action-btn {
		display: inline-flex;
		height: 32px;
		width: 32px;
		align-items: center;
		justify-content: center;
		border-radius: 9px;
		color: var(--text-secondary);
		transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
	}
	.action-btn:hover { background: var(--bg-hover); color: var(--text); transform: translateY(-1px); }
	.action-btn:disabled { opacity: 0.4; pointer-events: none; }
	@media (min-width: 640px) { .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (min-width: 1024px) {
		.dashboard-grid { grid-template-columns: 1fr 1.25fr 1fr; }
		.card-channel { grid-row: span 2; }
		.card-violations, .card-ideas, .card-performance, .card-news, .card-comments, .card-published { min-width: 0; }
		.stat-card, .studio-card { padding: 24px; border-radius: 26px; }
	}
	@media (min-width: 1536px) { .dashboard-grid { grid-template-columns: 1fr 1.2fr 1fr 1fr; } .card-channel { grid-row: span 2; } }
</style>
