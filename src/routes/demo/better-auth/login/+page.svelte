<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { form, data }: { form: ActionData; data: PageServerData } = $props();
</script>

<div class="max-w-md mx-auto p-6 bg-(--bg-elevated) rounded-(--radius-lg) shadow-(--shadow-card) border border-(--border)">
    <h1 class="text-2xl font-bold mb-6 text-center">Вход</h1>
    
    <form method="post" action="?/signInEmail" use:enhance class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Email</span>
            <input
                type="email"
                name="email"
                class="rounded-(--radius-sm) border border-(--border) bg-(--bg-subtle) px-3 py-2 text-sm focus:outline-hidden focus:border-(--accent) focus:ring-1 focus:ring-(--accent)"
            />
        </label>
        <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Пароль</span>
            <input
                type="password"
                name="password"
                class="rounded-(--radius-sm) border border-(--border) bg-(--bg-subtle) px-3 py-2 text-sm focus:outline-hidden focus:border-(--accent) focus:ring-1 focus:ring-(--accent)"
            />
        </label>
        <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Имя (для регистрации)</span>
            <input
                name="name"
                class="rounded-(--radius-sm) border border-(--border) bg-(--bg-subtle) px-3 py-2 text-sm focus:outline-hidden focus:border-(--accent) focus:ring-1 focus:ring-(--accent)"
            />
        </label>
        <div class="flex gap-3 mt-2">
            <button class="flex-1 rounded-(--radius-sm) bg-(--accent) text-(--text-inverse) px-4 py-2 text-sm font-medium hover:opacity-90 transition">
                Войти
            </button>
            <button
                formaction="?/signUpEmail"
                class="flex-1 rounded-(--radius-sm) bg-(--bg-hover) px-4 py-2 text-sm font-medium hover:bg-(--bg-active) transition"
            >
                Регистрация
            </button>
        </div>
    </form>
    {#if form?.message}
        <p class="mt-4 text-sm text-(--accent) text-center">{form.message}</p>
    {/if}
</div>