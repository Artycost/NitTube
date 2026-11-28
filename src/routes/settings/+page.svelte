<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { toasts } from '#lib/stores/toast.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let name = $state(data.profile.name);
	let username = $state(data.profile.username);
	let bio = $state(data.profile.bio);
	let avatar = $state(data.profile.image);
	let banner = $state(data.profile.banner);
	let bannerPreview = $state(data.profile.banner);
	let bannerFile = $state<File | null>(null);
	let saving = $state(false);
	let avatarInput = $state<HTMLInputElement>();
	let bannerInput = $state<HTMLInputElement>();

	const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
	const MAX_BANNER_SIZE = 20 * 1024 * 1024;

	const nameCooldown = $derived(data.profile.nameCooldown);
	const usernameCooldown = $derived(data.profile.usernameCooldown);

	$effect(() => {
		const preview = bannerPreview;
		return () => {
			if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
		};
	});

	function pickImage(kind: 'avatar' | 'banner') {
		(kind === 'avatar' ? avatarInput : bannerInput)?.click();
	}

	function loadImage(event: Event, kind: 'avatar' | 'banner') {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// Файл хранится в состоянии (bannerFile / data URL для аватара), а не в DOM.
		// Очищаем инпут сразу, чтобы можно было выбрать тот же файл повторно и чтобы
		// в FormData не попал невалидный файл, если проверка ниже не пройдёт.
		input.value = '';
		if (!file) return;
		if (!file.type.startsWith('image/')) return toasts.error('Нужен файл изображения');
		if (kind === 'banner' && !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
			return toasts.error('Баннер: JPEG, PNG, WebP или AVIF');
		}

		if (kind === 'avatar') {
			if (file.size > MAX_AVATAR_SIZE) return toasts.error('Аватар больше 2 МБ');
			const reader = new FileReader();
			reader.onload = () => {
				avatar = String(reader.result);
			};
			reader.readAsDataURL(file);
		} else {
			if (file.size > MAX_BANNER_SIZE) return toasts.error('Баннер больше 20 МБ');
			bannerFile = file;
			bannerPreview = URL.createObjectURL(file);
		}
	}
</script>

<svelte:head>
	<title>Настроить канал — VueTube</title>
</svelte:head>

<div class="mx-auto max-w-[1120px] px-4 pt-7 pb-24 sm:px-6 2xl:max-w-[1400px] 2xl:px-8 fade-in">
	<div class="mb-6 flex flex-wrap items-center gap-3.5">
		<div class="flex h-12 w-12 items-center justify-center rounded-[15px] bg-(--bg-subtle) 2xl:h-14 2xl:w-14">
			<Icon name="settings" size={23} />
		</div>
		<div>
			<h1 class="font-display text-[28px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[32px] 2xl:text-[36px]">Настроить канал</h1>
			<p class="mt-1 text-[13px] text-(--text-secondary) 2xl:text-[15px]">Профиль и ограничения вашего аккаунта</p>
		</div>
	</div>

	<section class="overflow-hidden rounded-[24px] bg-(--bg-elevated) 2xl:rounded-[28px]">
		<div class="h-40 bg-(--bg-subtle) sm:h-48 2xl:h-60">
			{#if bannerPreview}
				<img src={bannerPreview} alt="" class="h-full w-full object-cover" />
			{/if}
		</div>

		<div class="flex flex-wrap items-end justify-between gap-4 px-5 pb-6 sm:px-8 2xl:px-10 2xl:pb-8">
			<div class="flex items-end gap-4">
				<div class="shrink-0">
					<Avatar {name} image={avatar} id={data.profile.id} size={84} />
				</div>
				<div class="min-w-0 pb-1">
					<h2 class="font-display truncate text-[22px] font-extrabold tracking-[-0.02em]">{name || 'Без названия'}</h2>
					<p class="mt-0.5 text-[13px] text-(--text-secondary)">@{username || 'username'}</p>
					{#if bio}
						<p class="mt-2 max-w-lg text-[13px] leading-relaxed text-(--text-secondary)">{bio}</p>
					{/if}
				</div>
			</div>
			<a href="/channel/{data.profile.id}" class="btn-secondary h-10 px-4 text-[13px]">
				<Icon name="external" size={16} />
				Открыть канал
			</a>
		</div>
	</section>

	<form
		method="post"
		action="?/save"
		enctype="multipart/form-data"
		use:enhance={({ formData }) => {
			// `use:enhance` отправляет нативный FormData формы, а файловый инпут
			// намеренно очищается после выбора. Добавляем выбранный файл вручную —
			// иначе сервер получает пустой bannerFile и перезаписывает баннер старым
			// значением из скрытого поля (или удаляет его).
			if (bannerFile) formData.set('bannerFile', bannerFile);
			else formData.delete('bannerFile');
			saving = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				saving = false;
				if (result.type === 'success' && typeof result.data?.banner === 'string') {
					banner = result.data.banner;
					bannerPreview = banner;
					bannerFile = null;
				}
			};
		}}
		class="mt-5 rounded-[24px] bg-(--bg-elevated) p-5 sm:p-7 2xl:rounded-[28px] 2xl:p-9"
	>
		<input type="hidden" name="image" value={avatar} />
		<input type="hidden" name="banner" value={banner} />
		<input bind:this={avatarInput} type="file" accept="image/*" class="hidden" onchange={(e) => loadImage(e, 'avatar')} />
		<input bind:this={bannerInput} type="file" name="bannerFile" accept="image/jpeg,image/png,image/webp,image/avif" class="hidden" onchange={(e) => loadImage(e, 'banner')} />

		<div class="mb-6 flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--bg-subtle)">
				<Icon name="edit" size={16} />
			</div>
			<h2 class="font-display text-[17px] font-bold">Основная информация</h2>
		</div>

		<div class="flex flex-col gap-6">
			<label class="flex flex-col gap-2">
				<span class="flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold">
					Никнейм
					{#if nameCooldown > 0}
						<span class="inline-flex items-center gap-1 rounded-[8px] bg-(--bg-subtle) px-2 py-1 text-[11px] font-medium text-(--text-tertiary)">
							<Icon name="lock" size={12} />
							ещё {nameCooldown} дн.
						</span>
					{:else}
						<span class="text-[11px] font-normal text-(--text-tertiary)">{name.length}/24</span>
					{/if}
				</span>
				<input bind:value={name} name="name" maxlength="24" class="field h-12 w-full px-4" placeholder="Только буквы, цифры и дефис" />
			</label>

			<label class="flex flex-col gap-2">
				<span class="flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold">
					Юзернейм
					{#if usernameCooldown > 0}
						<span class="inline-flex items-center gap-1 rounded-[8px] bg-(--bg-subtle) px-2 py-1 text-[11px] font-medium text-(--text-tertiary)">
							<Icon name="lock" size={12} />
							ещё {usernameCooldown} дн.
						</span>
					{:else}
						<span class="text-[11px] font-normal text-(--text-tertiary)">{username.length}/20</span>
					{/if}
				</span>
				<div class="flex h-12 items-center rounded-[10px] border border-(--border) bg-(--bg-subtle) focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-(--accent-soft)">
					<span class="pl-4 text-[14px] text-(--text-tertiary)">@</span>
					<input bind:value={username} name="username" maxlength="20" class="h-full min-w-0 flex-1 bg-transparent px-1 text-[14px] outline-none" placeholder="username" />
				</div>
				<span class="text-[12px] text-(--text-tertiary)">Латинские буквы, цифры, эмодзи и подчёркивание. Без пробелов.</span>
			</label>

			<label class="flex flex-col gap-2">
				<span class="flex items-center justify-between text-[13px] font-semibold">
					Описание
					<span class="text-[11px] font-normal text-(--text-tertiary)">{bio.length}/500</span>
				</span>
				<textarea bind:value={bio} name="bio" maxlength="500" rows="4" class="field h-auto w-full resize-none px-4 py-3" placeholder="Расскажите о своём канале"></textarea>
				<span class="text-[12px] text-(--text-tertiary)">Без эмодзи и специальных символов</span>
			</label>

			<div class="flex flex-wrap gap-2">
				<button type="button" class="btn-secondary h-10 px-4 text-[13px]" onclick={() => pickImage('avatar')}>
					<Icon name="camera" size={16} />
					Сменить аватар
				</button>
				<button type="button" class="btn-secondary h-10 px-4 text-[13px]" onclick={() => pickImage('banner')}>
					<Icon name="image" size={16} />
					Сменить баннер
				</button>
			</div>
			<p class="text-[12px] text-(--text-tertiary)">Баннер — до 20 МБ, аватар — до 2 МБ</p>
		</div>

		<div class="mt-8 flex flex-wrap items-center gap-3 border-t border-(--border) pt-6">
			<button type="submit" class="btn-primary h-11 px-6" disabled={saving}>
				<Icon name="check" size={18} />
				{saving ? 'Сохраняем...' : 'Сохранить'}
			</button>
			<a href="/" class="btn-secondary h-11 px-6">Отмена</a>

			{#if form?.success}
				<span class="ml-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-(--text-secondary)">
					<Icon name="check" size={15} />
					Сохранено
				</span>
			{:else if form?.message}
				<span class="ml-1 text-[13px] font-medium text-(--accent)">{form.message}</span>
			{/if}
		</div>
	</form>

	<section class="mt-5 rounded-[24px] bg-(--bg-elevated) p-5 sm:p-7">
		<div class="mb-4 flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--bg-subtle)">
				<Icon name="lock" size={16} />
			</div>
			<h2 class="font-display text-[17px] font-bold">Авторские права</h2>
			{#if data.copyright.strikes > 0}
				<span class="ml-auto rounded-[8px] bg-(--bg-subtle) px-2.5 py-1 text-[11px] font-bold">
					{data.copyright.strikes} / 3 предупреждений
				</span>
			{/if}
		</div>
		<p class="text-[12px] leading-relaxed text-(--text-secondary)">
			Загрузите эталонный файл — одинаковые видео других авторов будут заблокированы автоматически. Три предупреждения за 90 дней ведут к заморозке аккаунта.
		</p>

		{#if data.copyright.references.length > 0}
			<div class="mt-4 flex flex-col gap-2">
				{#each data.copyright.references as ref (ref.id)}
					<div class="flex items-center gap-3 rounded-[12px] bg-(--bg-subtle) px-3 py-2">
						<Icon name="check" size={14} />
						<span class="min-w-0 flex-1 truncate text-[12px] font-medium">{ref.title}</span>
						<span class="text-[11px] text-(--text-tertiary)">эталон</span>
					</div>
				{/each}
			</div>
		{/if}

		<form method="POST" action="?/registerCopyright" use:enhance class="mt-4 flex flex-wrap gap-2" enctype="multipart/form-data">
			<input type="text" name="title" class="field h-10 min-w-[180px] flex-1 px-3" placeholder="Название произведения" />
			<input type="file" name="reference" accept="video/*,audio/*" class="field h-10 w-full min-w-[180px] flex-1 px-3 text-[12px] sm:w-auto" required />
			<button type="submit" class="btn-secondary h-10 px-4 text-[12px]">Добавить эталон</button>
		</form>
	</section>
</div>
