<script lang="ts">
	import type { Snippet } from 'svelte';
	import { themeStore } from '#lib/stores/theme.svelte';
	import Logo from './Logo.svelte';
	import Icon from './Icon.svelte';

	let {
		title,
		subtitle,
		children,
		footer
	}: {
		title: string;
		subtitle: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	const themeIcon = $derived(
		themeStore.current === 'light' ? 'sun' : themeStore.current === 'dark' ? 'moon' : 'monitor'
	);

	const features = [
		'Смотрите и загружайте видео',
		'Подписывайтесь на авторов',
		'Обсуждайте в комментариях'
	] as const;
</script>

<div class="grid min-h-dvh bg-(--bg) lg:grid-cols-[1.05fr_1fr]">
	<aside class="hidden flex-col justify-between bg-(--bg-elevated) p-10 text-white lg:flex">
		<div>
			<Logo />
		</div>

		<div class="max-w-md">
			<h2 class="font-display text-[46px] leading-[1.04] font-extrabold tracking-[-0.045em]">
				Смотрите.<br />Создавайте.<br />
				<span class="text-white">Делитесь.</span>
			</h2>
			<p class="mt-6 max-w-xs text-[15px] leading-relaxed text-white/50">
				Ваша видеоплатформа без лишнего шума. Только то, что действительно важно.
			</p>

			<div class="mt-9 flex flex-col gap-3">
				{#each features as feature (feature)}
					<div class="flex items-center gap-3 text-[13px] font-medium text-white/70">
						<span class="flex h-6 w-6 items-center justify-center rounded-[8px] bg-white/10">
							<Icon name="check" size={13} strokeWidth={2.6} />
						</span>
						{feature}
					</div>
				{/each}
			</div>
		</div>

		<p class="text-[11px] text-white/30">VueTube © 2026</p>
	</aside>

	<div class="relative flex items-center justify-center px-5 py-12 sm:px-8">
		<button
			class="icon-btn absolute top-4 right-4"
			onclick={() => themeStore.toggle()}
			aria-label="Сменить тему"
			title="Тема оформления"
		>
			<Icon name={themeIcon} size={20} />
		</button>

		<div class="auth-card w-full max-w-[400px] fade-in">
			<div class="mb-8 lg:hidden">
				<Logo />
			</div>

			<div class="mb-7">
				<h1 class="font-display text-[30px] leading-tight font-extrabold tracking-[-0.035em]">{title}</h1>
				<p class="mt-2 text-[14px] text-(--text-secondary)">{subtitle}</p>
			</div>

			{@render children()}

			{#if footer}
				<div class="mt-7 border-t border-(--border) pt-6 text-center text-[13px] text-(--text-secondary)">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.auth-card {
		background: var(--bg-elevated);
		border-radius: 24px;
		padding: 28px;
		box-shadow: 0 24px 60px -30px rgb(0 0 0 / 0.8);
	}
	@media (min-width: 640px) {
		.auth-card { padding: 32px; }
	}
</style>
