<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import VerifiedBadge from '#lib/components/VerifiedBadge.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import { formatCompact, formatDateShort, formatDuration } from '#lib/utils/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Tab = 'overview' | 'users' | 'content' | 'reports' | 'activity';
	const tabs: { id: Tab; label: string; icon: string }[] = [
		{ id: 'overview', label: 'Обзор', icon: 'chart' },
		{ id: 'users', label: 'Пользователи', icon: 'users' },
		{ id: 'content', label: 'Контент', icon: 'film' },
		{ id: 'reports', label: 'Жалобы', icon: 'info' },
		{ id: 'activity', label: 'Журнал', icon: 'clock' }
	];

	let tab = $state<Tab>('overview');
	let userQuery = $state('');
	let contentQuery = $state('');
	let contentFilter = $state<'all' | 'hidden' | 'claimed'>('all');
	const message = $derived((form as { message?: string } | null)?.message ?? '');

	const stats = $derived([
		{ label: 'Визиты за сутки', value: formatCompact(data.stats.visits), hint: `${data.stats.uniqueVisitors} уникальных`, icon: 'eye' },
		{ label: 'Пользователи', value: String(data.stats.usersTotal), hint: `+${data.stats.registrationsToday} за сутки`, icon: 'users' },
		{ label: 'Видео', value: String(data.stats.videos), hint: `${formatCompact(data.stats.views)} просмотров`, icon: 'film' },
		{ label: 'Жалобы', value: String(data.stats.pendingReports), hint: 'ожидают решения', icon: 'info' },
		{ label: 'Скрыто', value: String(data.stats.hidden), hint: `${data.stats.claimed} по авторским правам`, icon: 'eyeOff' },
		{ label: 'В эфире', value: String(data.stats.live), hint: `${data.stats.frozen} заморожено`, icon: 'monitor' }
	]);

	const filteredUsers = $derived(
		data.users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(userQuery.toLowerCase()))
	);

	const filteredContent = $derived(
		data.content.filter((v) => {
			const matches = `${v.title} ${v.author}`.toLowerCase().includes(contentQuery.toLowerCase());
			const status =
				contentFilter === 'hidden'
					? v.visibility === 'private'
					: contentFilter === 'claimed'
						? v.copyrightStatus === 'claimed'
						: true;
			return matches && status;
		})
	);

	const frozen = (value: string | null) => Boolean(value && new Date(value) > new Date());
</script>

<svelte:head>
	<title>Админ-панель — VueTube</title>
</svelte:head>

<div class="admin-page fade-in">
	<header class="admin-header">
		<div class="flex h-14 w-14 items-center justify-center rounded-[18px] bg-linear-to-br from-white/18 to-white/4 shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] ring-1 ring-white/10">
			<Icon name="lock" size={26} />
		</div>
		<div>
			<h1 class="font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">Админ-панель</h1>
			<p class="mt-1 text-[13px] text-(--text-secondary)">Управление платформой, контентом и модерацией</p>
		</div>
		<span class="ml-auto inline-flex items-center gap-2 rounded-full bg-white/8 px-3.5 py-2 text-[11px] font-bold tracking-wide ring-1 ring-white/10">
			<span class="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"></span>
			ADMIN
		</span>
	</header>

	{#if message}
		<div class="mt-4 flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/6 px-4 py-3 text-[13px]">
			<Icon name="check" size={16} />
			{message}
		</div>
	{/if}

	<nav class="admin-tabs mt-6">
		{#each tabs as item (item.id)}
			<button class:active={tab === item.id} onclick={() => (tab = item.id)}>
				<Icon name={item.icon} size={16} />
				<span>{item.label}</span>
				{#if item.id === 'reports' && data.stats.pendingReports > 0}
					<span class="tab-badge">{data.stats.pendingReports}</span>
				{/if}
			</button>
		{/each}
	</nav>

	{#if tab === 'overview'}
		<div class="stats-grid mt-5">
			{#each stats as card (card.label)}
				<div class="stat-card">
					<div class="flex items-start justify-between">
						<span class="text-[12px] font-medium text-(--text-secondary)">{card.label}</span>
						<span class="stat-icon"><Icon name={card.icon} size={18} /></span>
					</div>
					<p class="font-display mt-4 text-[30px] leading-none font-extrabold tabular-nums">{card.value}</p>
					<p class="mt-2 text-[11px] text-(--text-tertiary)">{card.hint}</p>
				</div>
			{/each}
		</div>

		<div class="mt-5 grid gap-5 lg:grid-cols-2">
			<section class="panel">
				<div class="panel-head">
					<div><h2 class="font-display text-[17px] font-bold">Последние видео</h2><p class="panel-sub">Что появлялось на платформе</p></div>
					<button class="admin-btn" onclick={() => (tab = 'content')}>Все видео <Icon name="chevronRight" size={14} /></button>
				</div>
				<div class="divide-y divide-white/5">
					{#each data.content.slice(0, 5) as video (video.id)}
						<a href="/watch/{video.id}" class="flex items-center gap-3 px-5 py-3 transition hover:bg-white/4">
							{#if video.thumbnail}<img src={video.thumbnail} alt="" class="h-10 w-16 rounded-[8px] object-cover" />{:else}<span class="flex h-10 w-16 items-center justify-center rounded-[8px] bg-white/6"><Icon name="film" size={16} /></span>{/if}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[13px] font-semibold">{video.title}</span>
								<span class="block truncate text-[11px] text-(--text-tertiary)">{video.author} · {formatDateShort(video.publishedAt)}</span>
							</span>
							{#if video.visibility === 'private'}<span class="badge">Скрыто</span>{/if}
						</a>
					{/each}
					{#if !data.content.length}<p class="empty">Видео пока нет</p>{/if}
				</div>
			</section>

			<section class="panel">
				<div class="panel-head">
					<div><h2 class="font-display text-[17px] font-bold">Последние действия</h2><p class="panel-sub">Журнал администратора</p></div>
					<button class="admin-btn" onclick={() => (tab = 'activity')}>Журнал <Icon name="chevronRight" size={14} /></button>
				</div>
				<div class="divide-y divide-white/5">
					{#each data.activity.slice(0, 6) as item (item.id)}
						<div class="flex items-center gap-3 px-5 py-3">
							<span class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/6"><Icon name="clock" size={15} /></span>
							<span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-semibold">{item.action}</span><span class="block truncate text-[11px] text-(--text-tertiary)">{item.admin} · {item.detail}</span></span>
							<span class="text-[11px] text-(--text-tertiary)">{formatDateShort(item.createdAt)}</span>
						</div>
					{/each}
					{#if !data.activity.length}<p class="empty">Действий пока нет</p>{/if}
				</div>
			</section>
		</div>
	{/if}

	{#if tab === 'users'}
		<section class="panel mt-5">
			<div class="panel-head">
				<div><h2 class="font-display text-[17px] font-bold">Пользователи</h2><p class="panel-sub">{data.users.length} аккаунтов · {data.stats.frozen} заморожено</p></div>
				<label class="search"><Icon name="search" size={15} /><input bind:value={userQuery} placeholder="Имя или email" /></label>
			</div>
			<div class="overflow-x-auto no-scrollbar">
				<table class="w-full min-w-[860px] text-left text-[13px]">
					<thead><tr class="table-head"><th class="px-5 py-3 sm:px-6">Пользователь</th><th class="px-3 py-3">Статус</th><th class="px-3 py-3">Дата</th><th class="px-5 py-3 text-right sm:px-6">Действия</th></tr></thead>
					<tbody>
						{#each filteredUsers as u (u.id)}
							<tr class="table-row">
								<td class="px-5 py-3 sm:px-6">
									<div class="flex items-center gap-3">
										<Avatar name={u.name} id={u.id} size={36} />
										<div class="min-w-0"><p class="flex items-center gap-1.5 truncate font-semibold">{u.name}{#if u.verified}<VerifiedBadge size={13} />{/if}{#if u.creator}<Icon name="sparkles" size={13} />{/if}</p><p class="truncate text-[11px] text-(--text-tertiary)">{u.email}</p></div>
									</div>
								</td>
								<td class="px-3 py-3">
									{#if frozen(u.bannedUntil)}<span class="badge badge-warn">Заморожен</span>{:else}<span class="text-[11px] text-(--text-tertiary)">Активен</span>{/if}
								</td>
								<td class="px-3 py-3 text-[11px] text-(--text-tertiary)">{formatDateShort(u.createdAt)}</td>
								<td class="px-5 py-3 sm:px-6">
									<div class="flex flex-wrap justify-end gap-1.5">
										<form method="POST" action="?/verify" use:enhance><input type="hidden" name="id" value={u.id} /><button class="admin-btn" title={u.verified ? 'Снять верификацию' : 'Верифицировать'}><Icon name="verified" size={13} />{u.verified ? 'Снять' : 'Верифицировать'}</button></form>
										<form method="POST" action="?/creator" use:enhance><input type="hidden" name="id" value={u.id} /><button class="admin-btn" title="Статус создателя"><Icon name="sparkles" size={13} />{u.creator ? 'Снять' : 'Создатель'}</button></form>
										{#if frozen(u.bannedUntil)}
											<form method="POST" action="?/unfreeze" use:enhance><input type="hidden" name="id" value={u.id} /><button class="admin-btn admin-btn-accent"><Icon name="check" size={13} />Разморозить</button></form>
										{:else}
											<form method="POST" action="?/freeze" use:enhance class="flex gap-1">
												<input type="hidden" name="id" value={u.id} />
												<select name="days" class="days" aria-label="Срок блокировки"><option value="1">1 дн.</option><option value="7" selected>7 дн.</option><option value="30">30 дн.</option><option value="365">365 дн.</option></select>
												<button class="admin-btn admin-btn-danger" title="Заморозить"><Icon name="lock" size={13} />Заморозить</button>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	{#if tab === 'content'}
		<section class="panel mt-5">
			<div class="panel-head">
				<div><h2 class="font-display text-[17px] font-bold">Контент</h2><p class="panel-sub">{data.content.length} видео · {data.stats.hidden} скрыто · {data.stats.claimed} заблокировано</p></div>
				<div class="flex flex-wrap items-center gap-2">
					<div class="segmented">
						<button class:active={contentFilter === 'all'} onclick={() => (contentFilter = 'all')}>Все</button>
						<button class:active={contentFilter === 'hidden'} onclick={() => (contentFilter = 'hidden')}>Скрытые</button>
						<button class:active={contentFilter === 'claimed'} onclick={() => (contentFilter = 'claimed')}>Заблокированные</button>
					</div>
					<label class="search"><Icon name="search" size={15} /><input bind:value={contentQuery} placeholder="Название или автор" /></label>
				</div>
			</div>
			<div class="content-grid">
				{#each filteredContent as v (v.id)}
					<div class="video-card">
						<a href="/watch/{v.id}" class="relative block aspect-video overflow-hidden rounded-[12px] bg-black">
							{#if v.thumbnail}<img src={v.thumbnail} alt="" class="h-full w-full object-cover" />{:else}<span class="flex h-full w-full items-center justify-center"><Icon name="film" size={22} /></span>{/if}
							<span class="absolute right-2 bottom-2 rounded-[6px] bg-black/75 px-1.5 py-0.5 text-[10px] font-bold">{formatDuration(v.duration)}</span>
						</a>
						<div class="mt-3 min-w-0">
							<a href="/watch/{v.id}" class="block truncate text-[13px] font-semibold">{v.title}</a>
							<p class="mt-0.5 truncate text-[11px] text-(--text-tertiary)">{v.author} · {formatCompact(v.viewCount)} просмотров</p>
							<div class="mt-2 flex flex-wrap gap-1.5">
								{#if v.visibility === 'private'}<span class="badge badge-warn">Скрыто</span>{/if}
								{#if v.copyrightStatus === 'claimed'}<span class="badge badge-danger">Авторские права</span>{/if}
							</div>
						</div>
						<div class="mt-3 flex flex-wrap gap-1.5 border-t border-white/6 pt-3">
							<a href="/watch/{v.id}" class="admin-btn" title="Открыть"><Icon name="external" size={13} />Открыть</a>
							{#if v.visibility === 'private'}
								<form method="POST" action="?/unhideVideo" use:enhance><input type="hidden" name="id" value={v.id} /><button class="admin-btn admin-btn-accent"><Icon name="eye" size={13} />Показать</button></form>
							{:else}
								<form method="POST" action="?/hideVideo" use:enhance><input type="hidden" name="id" value={v.id} /><button class="admin-btn"><Icon name="eyeOff" size={13} />Скрыть</button></form>
							{/if}
							{#if v.copyrightStatus === 'claimed'}
								<form method="POST" action="?/unclaimVideo" use:enhance><input type="hidden" name="id" value={v.id} /><button class="admin-btn">Снять блок</button></form>
							{:else}
								<form method="POST" action="?/claimVideo" use:enhance class="flex gap-1"><input type="hidden" name="id" value={v.id} /><input name="reason" placeholder="Причина" class="reason" /><button class="admin-btn admin-btn-danger" title="Заблокировать"><Icon name="lock" size={13} />Бан</button></form>
							{/if}
							<form method="POST" action="?/deleteVideo" use:enhance><input type="hidden" name="id" value={v.id} /><button class="admin-btn admin-btn-danger" title="Удалить навсегда"><Icon name="trash" size={13} />Удалить</button></form>
						</div>
					</div>
				{/each}
			</div>
			{#if !filteredContent.length}<p class="empty">Ничего не найдено</p>{/if}
		</section>
	{/if}

	{#if tab === 'reports'}
		<section class="panel mt-5">
			<div class="panel-head"><div><h2 class="font-display text-[17px] font-bold">Жалобы на видео</h2><p class="panel-sub">{data.reports.length} обращений</p></div><Icon name="info" size={20} class="text-(--text-tertiary)" /></div>
			{#if data.reports.length}
				<div class="overflow-x-auto no-scrollbar"><table class="w-full min-w-[720px] text-left text-[13px]">
					<thead><tr class="table-head"><th class="px-5 py-3 sm:px-6">Видео</th><th class="px-3 py-3">Причина</th><th class="px-3 py-3">Отправитель</th><th class="px-5 py-3 text-right sm:px-6">Действия</th></tr></thead>
					<tbody>
						{#each data.reports as r (r.id)}
							<tr class="table-row">
								<td class="px-5 py-3 sm:px-6"><a href="/watch/{r.videoId}" class="block max-w-[240px] truncate font-semibold">{r.videoTitle}</a><span class="text-[11px] text-(--text-tertiary)">{formatDateShort(r.createdAt)}</span></td>
								<td class="px-3 py-3"><span class="text-[12px] font-semibold">{r.reason}</span>{#if r.detail}<span class="mt-0.5 block max-w-[240px] truncate text-[11px] text-(--text-tertiary)">{r.detail}</span>{/if}</td>
								<td class="px-3 py-3 text-[12px]">{r.reporter}</td>
								<td class="px-5 py-3 sm:px-6">
									{#if r.status === 'pending'}
										<div class="flex justify-end gap-1.5">
											<form method="POST" action="?/resolveReport" use:enhance><input type="hidden" name="id" value={r.id} /><input type="hidden" name="videoId" value={r.videoId} /><button class="admin-btn">Решить</button></form>
											<form method="POST" action="?/resolveReport" use:enhance><input type="hidden" name="id" value={r.id} /><input type="hidden" name="videoId" value={r.videoId} /><input type="hidden" name="hide" value="1" /><button class="admin-btn admin-btn-danger">Скрыть видео</button></form>
											<form method="POST" action="?/rejectReport" use:enhance><input type="hidden" name="id" value={r.id} /><button class="admin-btn">Отклонить</button></form>
										</div>
									{:else}<span class="text-[11px] text-(--text-tertiary)">{r.status === 'resolved' ? 'Решено' : 'Отклонено'}</span>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table></div>
			{:else}<p class="empty">Жалоб на видео нет</p>{/if}
		</section>

		<section class="panel mt-5">
			<div class="panel-head"><div><h2 class="font-display text-[17px] font-bold">Жалобы на комментарии</h2><p class="panel-sub">{data.commentReports.length} обращений</p></div><Icon name="comment" size={20} class="text-(--text-tertiary)" /></div>
			{#if data.commentReports.length}
				<div class="divide-y divide-white/5">
					{#each data.commentReports as r (r.id)}
						<div class="flex flex-wrap items-center gap-3 px-5 py-3">
							<span class="min-w-0 flex-1"><span class="block truncate text-[13px]">{r.content}</span><span class="block text-[11px] text-(--text-tertiary)">{r.reason ?? 'Без причины'} · {r.reporter} · {formatDateShort(r.createdAt)}</span></span>
							<form method="POST" action="?/deleteComment" use:enhance><input type="hidden" name="id" value={r.id} /><input type="hidden" name="commentId" value={r.commentId} /><button class="admin-btn admin-btn-danger"><Icon name="trash" size={13} />Удалить комментарий</button></form>
						</div>
					{/each}
				</div>
			{:else}<p class="empty">Жалоб на комментарии нет</p>{/if}
		</section>

		<section class="panel mt-5">
			<div class="panel-head"><div><h2 class="font-display text-[17px] font-bold">Авторские права</h2><p class="panel-sub">{data.claims.length} обращений</p></div><Icon name="lock" size={20} class="text-(--text-tertiary)" /></div>
			{#if data.claims.length}
				<div class="overflow-x-auto no-scrollbar"><table class="w-full min-w-[640px] text-left text-[13px]">
					<thead><tr class="table-head"><th class="px-5 py-3 sm:px-6">Видео</th><th class="px-3 py-3">Заявитель</th><th class="px-3 py-3">Статус</th><th class="px-5 py-3 text-right sm:px-6">Действия</th></tr></thead>
					<tbody>
						{#each data.claims as c (c.id)}
							<tr class="table-row">
								<td class="px-5 py-3 sm:px-6"><a href="/watch/{c.videoId}" class="block max-w-[260px] truncate font-semibold">{c.videoTitle}</a><span class="block max-w-[260px] truncate text-[11px] text-(--text-tertiary)">{c.reason}</span></td>
								<td class="px-3 py-3">{c.claimant}</td>
								<td class="px-3 py-3"><span class="badge">{c.status}</span></td>
								<td class="px-5 py-3 sm:px-6">{#if c.status === 'pending'}<div class="flex justify-end gap-1.5"><form method="POST" action="?/uphold" use:enhance><input type="hidden" name="id" value={c.id} /><button class="admin-btn admin-btn-danger">Подтвердить</button></form><form method="POST" action="?/reject" use:enhance><input type="hidden" name="id" value={c.id} /><button class="admin-btn">Отклонить</button></form></div>{:else}<span class="text-[11px] text-(--text-tertiary)">Обработано</span>{/if}</td>
							</tr>
						{/each}
					</tbody>
				</table></div>
			{:else}<p class="empty">Жалоб пока нет</p>{/if}
		</section>
	{/if}

	{#if tab === 'activity'}
		<section class="panel mt-5">
			<div class="panel-head"><div><h2 class="font-display text-[17px] font-bold">Журнал действий</h2><p class="panel-sub">{data.activity.length} записей</p></div>
				<form method="POST" action="?/clearLog" use:enhance><button class="admin-btn admin-btn-danger"><Icon name="trash" size={13} />Очистить</button></form>
			</div>
			{#if data.activity.length}
				<div class="divide-y divide-white/5">
					{#each data.activity as item (item.id)}
						<div class="flex items-center gap-3 px-5 py-3">
							<span class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/6"><Icon name="clock" size={15} /></span>
							<span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-semibold">{item.action}</span><span class="block truncate text-[11px] text-(--text-tertiary)">{item.admin} · {item.detail}</span></span>
							<span class="text-[11px] text-(--text-tertiary)">{formatDateShort(item.createdAt)}</span>
						</div>
					{/each}
				</div>
			{:else}<p class="empty">Журнал пуст</p>{/if}
		</section>
	{/if}
</div>

<style>
	.admin-page { max-width: 1320px; margin: 0 auto; padding: 28px 16px 80px; }
	.admin-header { display: flex; align-items: center; gap: 16px; }
	.admin-tabs { display: flex; gap: 6px; overflow-x: auto; border-radius: 16px; border: 1px solid rgb(255 255 255 / 0.07); background: rgb(255 255 255 / 0.025); padding: 5px; scrollbar-width: none; }
	.admin-tabs::-webkit-scrollbar { display: none; }
	.admin-tabs button { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; border-radius: 12px; padding: 9px 14px; font-size: 12px; font-weight: 700; color: var(--text-secondary); transition: all 0.2s cubic-bezier(0.16,1,0.3,1); }
	.admin-tabs button:hover { background: rgb(255 255 255 / 0.06); color: var(--text); }
	.admin-tabs button.active { background: linear-gradient(180deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0.07)); color: #fff; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 6px 18px -10px rgb(255 255 255 / 0.4); }
	.tab-badge { border-radius: 999px; background: #fff; padding: 1px 6px; font-size: 10px; color: #050505; }
	.stats-grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
	@media (min-width: 768px) { .stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
	.stat-card { border-radius: 20px; border: 1px solid rgb(255 255 255 / 0.055); background: linear-gradient(160deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0.012)); padding: 18px; transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease; }
	.stat-card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -20px rgb(0 0 0 / 0.9); }
	.stat-icon { display: inline-flex; height: 36px; width: 36px; align-items: center; justify-content: center; border-radius: 11px; background: rgb(255 255 255 / 0.07); }
	.panel { overflow: hidden; border-radius: 22px; border: 1px solid rgb(255 255 255 / 0.055); background: linear-gradient(160deg, rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.01)); }
	.panel-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 20px; }
	.panel-sub { margin-top: 4px; font-size: 12px; color: var(--text-tertiary); }
	.table-head { border-block: 1px solid rgb(255 255 255 / 0.06); font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-tertiary); }
	.table-row { border-bottom: 1px solid rgb(255 255 255 / 0.045); transition: background-color 0.18s ease; }
	.table-row:hover { background: rgb(255 255 255 / 0.035); }
	.badge { display: inline-flex; border-radius: 8px; background: rgb(255 255 255 / 0.08); padding: 3px 8px; font-size: 10px; font-weight: 800; }
	.badge-warn { background: rgb(255 255 255 / 0.16); }
	.badge-danger { background: rgb(255 255 255 / 0.22); }
	.admin-btn { display: inline-flex; height: 30px; align-items: center; justify-content: center; gap: 5px; border-radius: 9px; background: rgb(255 255 255 / 0.09); padding: 0 10px; font-size: 11px; font-weight: 700; transition: all 0.18s ease; }
	.admin-btn:hover { background: rgb(255 255 255 / 0.17); transform: translateY(-1px); }
	.admin-btn-accent { background: #ececec; color: #050505; }
	.admin-btn-accent:hover { background: #fff; }
	.admin-btn-danger { background: rgb(255 255 255 / 0.16); }
	.admin-btn-danger:hover { background: rgb(255 255 255 / 0.26); }
	.days, .reason, .search input { border-radius: 8px; background: rgb(255 255 255 / 0.06); font-size: 11px; padding: 0 8px; color: var(--text); outline: none; }
	.days { height: 30px; }
	.reason { height: 30px; width: 100px; }
	.search { display: flex; height: 34px; align-items: center; gap: 7px; border-radius: 10px; background: rgb(255 255 255 / 0.05); padding: 0 10px; color: var(--text-tertiary); }
	.search input { width: 170px; height: 100%; background: transparent; padding: 0; }
	.segmented { display: flex; gap: 3px; border-radius: 10px; background: rgb(255 255 255 / 0.04); padding: 3px; }
	.segmented button { border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 700; color: var(--text-secondary); }
	.segmented button.active { background: rgb(255 255 255 / 0.14); color: #fff; }
	.content-grid { display: grid; gap: 14px; padding: 0 20px 20px; grid-template-columns: repeat(1, minmax(0, 1fr)); }
	@media (min-width: 640px) { .content-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (min-width: 1100px) { .content-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
	.video-card { border-radius: 16px; border: 1px solid rgb(255 255 255 / 0.05); background: rgb(255 255 255 / 0.025); padding: 12px; transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), background-color 0.22s ease; }
	.video-card:hover { transform: translateY(-2px); background: rgb(255 255 255 / 0.045); }
	.empty { padding: 36px 20px; text-align: center; font-size: 13px; color: var(--text-tertiary); }
</style>
