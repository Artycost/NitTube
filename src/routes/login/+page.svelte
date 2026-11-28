<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient } from '#lib/auth-client';
	import { toasts } from '#lib/stores/toast.svelte';
	import AuthLayout from '#lib/components/AuthLayout.svelte';
	import GoogleIcon from '#lib/components/GoogleIcon.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let googleLoading = $state(false);
	let loading = $state(false);

	async function signInWithGoogle() {
		if (!data.googleEnabled) {
			toasts.info('Добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в .env');
			return;
		}
		googleLoading = true;
		const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
		if (error) {
			toasts.error(error.message ?? 'Не удалось войти через Google');
			googleLoading = false;
		}
	}
</script>

<AuthLayout title="С возвращением" subtitle="Войдите, чтобы продолжить">
	<form
		method="post"
		action="?/signInEmail"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				await update({ reset: false });
				loading = false;
			};
		}}
		class="flex flex-col gap-4"
	>
		<button type="button" class="google-btn" onclick={signInWithGoogle} disabled={googleLoading}>
			<GoogleIcon size={18} />
			{googleLoading ? 'Подключаем...' : 'Войти через Google'}
		</button>

		<div class="auth-divider">или</div>

		<label class="flex flex-col gap-2">
			<span class="text-[13px] font-semibold">Email</span>
			<input type="email" name="email" placeholder="you@example.com" class="field h-12 w-full px-4" required autocomplete="email" />
		</label>

		<label class="flex flex-col gap-2">
			<span class="text-[13px] font-semibold">Пароль</span>
			<input type="password" name="password" placeholder="••••••••" class="field h-12 w-full px-4" required autocomplete="current-password" />
		</label>

		<button type="submit" class="btn-primary mt-2 h-12 w-full text-[14px]" disabled={loading}>
			{#if loading}
				Входим...
			{:else}
				<Icon name="login" size={18} />
				Войти
			{/if}
		</button>

		{#if form?.message}
			<p class="rounded-[12px] bg-(--bg-subtle) px-4 py-3 text-center text-[13px] text-(--text-secondary)">{form.message}</p>
		{/if}
	</form>

	{#snippet footer()}
		Нет аккаунта?
		<a href="/register" class="ml-1 font-semibold text-(--text) transition hover:opacity-70">Зарегистрироваться</a>
	{/snippet}
</AuthLayout>
