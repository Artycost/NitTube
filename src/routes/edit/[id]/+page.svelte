<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import { UPLOAD_CATEGORIES } from '#lib/constants';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);
</script>

<svelte:head>
	<title>Редактирование видео — VueTube</title>
</svelte:head>

<div class="mx-auto max-w-[820px] px-4 pt-7 pb-24 sm:px-6 fade-in">
	<div class="mb-6 flex items-center gap-3.5">
		<button class="icon-btn" onclick={() => goto(`/watch/${data.video.id}`)} aria-label="Назад"><Icon name="arrowLeft" size={20} /></button>
		<div>
			<h1 class="font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em]">Редактировать видео</h1>
			<p class="mt-1 text-[13px] text-(--text-secondary)">Название, описание и доступ</p>
		</div>
	</div>

	<form
		method="post"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
		class="rounded-[24px] bg-(--bg-elevated) p-5 sm:p-7"
	>
		<label class="mb-5 block">
			<span class="mb-2 block text-[13px] font-semibold">Название</span>
			<input name="title" value={data.video.title} maxlength="120" class="field h-12 w-full px-4" />
		</label>

		<label class="mb-5 block">
			<span class="mb-2 block text-[13px] font-semibold">Описание</span>
			<textarea name="description" rows="6" class="field h-auto w-full resize-none px-4 py-3">{data.video.description}</textarea>
		</label>

		<label class="mb-5 block">
			<span class="mb-2 block text-[13px] font-semibold">Категория</span>
			<select name="category" class="field h-12 w-full px-4">
				{#each UPLOAD_CATEGORIES as category (category)}
					<option value={category} selected={data.video.category === category}>{category}</option>
				{/each}
			</select>
		</label>

		<label class="mb-5 block">
			<span class="mb-2 block text-[13px] font-semibold">Теги через запятую</span>
			<input name="tags" value={data.video.tags} class="field h-12 w-full px-4" />
		</label>

		<label class="mb-6 block">
			<span class="mb-2 block text-[13px] font-semibold">Доступ</span>
			<select name="visibility" class="field h-12 w-full px-4">
				<option value="public" selected={data.video.visibility === 'public'}>Открытое</option>
				<option value="unlisted" selected={data.video.visibility === 'unlisted'}>По ссылке</option>
				<option value="private" selected={data.video.visibility === 'private'}>Закрытое</option>
			</select>
		</label>

		<div class="flex flex-wrap items-center gap-3 border-t border-(--border) pt-6">
			<button type="submit" class="btn-primary h-11 px-6" disabled={saving}>
				<Icon name="check" size={18} />
				{saving ? 'Сохраняем...' : 'Сохранить'}
			</button>
			<a href="/watch/{data.video.id}" class="btn-secondary h-11 px-6">Отмена</a>
			{#if form?.success}<span class="text-[13px] font-semibold">Сохранено</span>{/if}
			{#if form?.message}<span class="text-[13px] text-(--accent)">{form.message}</span>{/if}
		</div>
	</form>
</div>
