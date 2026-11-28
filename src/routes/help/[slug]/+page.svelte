<script lang="ts">
	import { slide } from 'svelte/transition';
	import HelpTopbar from '#lib/components/HelpTopbar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { helpCategories } from '#lib/data/help';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const category = $derived(data.category);
	let open = $state<number | null>(0);
	let query = $state('');

	const filtered = $derived(
		category.faq.filter((item) =>
			`${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase())
		)
	);
</script>

<svelte:head>
	<title>{category.title} — Центр помощи VueTube</title>
	<meta name="description" content={category.description} />
</svelte:head>

<HelpTopbar />

<div class="help-root">
	<div class="glow glow-a"></div>

	<section class="hero" style="--hero-bg:{category.gradient}; --hero-glow:{category.glow}">
		<div class="hero-shine"></div>
		<div class="hero-inner">
			<a href="/help" class="back"><Icon name="arrowLeft" size={16} /> Все разделы</a>
			<div class="hero-main">
				<span class="hero-icon"><Icon name={category.icon} size={38} /></span>
				<div>
					<p class="eyebrow">РАЗДЕЛ СПРАВКИ</p>
					<h1 class="font-display">{category.title}</h1>
					<p class="hero-desc">{category.description}</p>
				</div>
			</div>
		</div>
	</section>

	<div class="content">
		<div class="section-pills">
			{#each helpCategories as item (item.slug)}
				<a href="/help/{item.slug}" class:active={item.slug === category.slug}>
					<Icon name={item.icon} size={14} /> {item.title}
				</a>
			{/each}
		</div>

		<div class="faq-head">
			<div>
				<h2 class="font-display">Частые вопросы</h2>
				<p>{filtered.length} вопросов в разделе «{category.title}»</p>
			</div>
			<label class="faq-search">
				<Icon name="search" size={17} />
				<input bind:value={query} placeholder="Найти вопрос" aria-label="Поиск по вопросам" />
			</label>
		</div>

		<div class="faq-list">
			{#each filtered as item, index (item.question)}
				<div class="faq-item" class:opened={open === index}>
					<button onclick={() => (open = open === index ? null : index)} aria-expanded={open === index}>
						<span class="number">{String(index + 1).padStart(2, '0')}</span>
						<span class="question">{item.question}</span>
						<span class="chevron"><Icon name={open === index ? 'x' : 'chevronDown'} size={18} /></span>
					</button>
					{#if open === index}
						<div class="answer" transition:slide={{ duration: 240 }}>
							<p>{item.answer}</p>
						</div>
					{/if}
				</div>
			{/each}
			{#if !filtered.length}<p class="empty">Ничего не найдено</p>{/if}
		</div>

		<section class="cta">
			<div class="cta-glow"></div>
			<span class="cta-icon"><Icon name="sparkles" size={24} /></span>
			<div class="cta-copy">
				<h3 class="font-display">Нужна помощь с другим разделом?</h3>
				<p>В центре помощи собраны ответы по всем функциям VueTube.</p>
			</div>
			<a href="/help" class="cta-button">Все разделы <Icon name="chevronRight" size={16} /></a>
		</section>
	</div>

	<footer class="help-footer">
		<span>VueTube Help · Центр помощи</span>
		<a href="/help">Все разделы справки</a>
	</footer>
</div>

<style>
	.help-root { position: relative; min-height: calc(100vh - 58px); overflow: hidden; background: var(--bg); }
	.glow-a { position: absolute; width: 700px; height: 700px; top: -320px; right: -240px; border-radius: 999px; background: rgb(255 255 255 / 0.05); filter: blur(120px); pointer-events: none; }
	.hero { position: relative; overflow: hidden; background: var(--hero-bg); }
	.hero-shine { position: absolute; inset: 0; background: radial-gradient(60% 130% at 85% 10%, var(--hero-glow), transparent 60%); pointer-events: none; }
	.hero-inner { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 26px 24px 56px; }
	.back { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: rgb(255 255 255 / 0.65); }
	.back:hover { color: #fff; }
	.hero-main { display: flex; align-items: center; gap: 22px; margin-top: 34px; }
	.hero-icon { display: inline-flex; flex-shrink: 0; width: 82px; height: 82px; align-items: center; justify-content: center; border-radius: 24px; background: linear-gradient(150deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0.05)); box-shadow: 0 20px 45px -20px rgb(0 0 0 / 0.9), 0 0 50px -18px var(--hero-glow); }
	.eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: rgb(255 255 255 / 0.55); }
	h1 { margin-top: 8px; font-size: clamp(34px, 4vw, 50px); line-height: 1.05; font-weight: 800; letter-spacing: -0.04em; }
	.hero-desc { max-width: 700px; margin-top: 12px; font-size: 14px; line-height: 1.7; color: rgb(255 255 255 / 0.68); }

	.content { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 40px 24px 60px; }
	.section-pills { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: none; }
	.section-pills::-webkit-scrollbar { display: none; }
	.section-pills a { display: inline-flex; flex-shrink: 0; align-items: center; gap: 7px; border-radius: 999px; background: rgb(255 255 255 / 0.05); padding: 9px 15px; font-size: 11px; font-weight: 700; color: var(--text-secondary); transition: all 0.2s ease; }
	.section-pills a:hover { background: rgb(255 255 255 / 0.1); color: #fff; }
	.section-pills a.active { background: #ececec; color: #050505; }
	.faq-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-top: 46px; }
	.faq-head h2 { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; }
	.faq-head p { margin-top: 6px; font-size: 12px; color: var(--text-tertiary); }
	.faq-search { display: flex; height: 42px; align-items: center; gap: 9px; border-radius: 13px; background: rgb(255 255 255 / 0.06); padding: 0 14px; color: var(--text-tertiary); }
	.faq-search input { width: 200px; background: transparent; font-size: 13px; outline: none; }
	.faq-list { margin-top: 22px; display: flex; flex-direction: column; gap: 6px; }
	.faq-item { overflow: hidden; border-radius: 18px; transition: background 0.22s ease; }
	.faq-item:hover { background: rgb(255 255 255 / 0.035); }
	.faq-item.opened { background: linear-gradient(100deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.025)); }
	.faq-item button { display: flex; width: 100%; align-items: center; gap: 18px; padding: 20px 22px; text-align: left; }
	.number { font-size: 11px; font-weight: 800; color: var(--text-tertiary); }
	.question { flex: 1; font-size: 15px; font-weight: 700; }
	.chevron { display: inline-flex; color: var(--text-tertiary); }
	.answer { padding: 0 22px 22px 52px; }
	.answer p { max-width: 820px; font-size: 14px; line-height: 1.8; color: var(--text-secondary); }
	.empty { padding: 50px; text-align: center; color: var(--text-tertiary); }

	.cta { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 18px; overflow: hidden; margin-top: 56px; border-radius: 26px; background: linear-gradient(110deg, #2a2a2a, #111); padding: 26px 28px; }
	.cta-glow { position: absolute; width: 340px; height: 340px; right: -120px; top: -180px; border-radius: 999px; background: rgb(255 255 255 / 0.12); filter: blur(70px); }
	.cta-icon { position: relative; display: inline-flex; width: 54px; height: 54px; align-items: center; justify-content: center; border-radius: 17px; background: rgb(255 255 255 / 0.1); }
	.cta-copy { position: relative; flex: 1; min-width: 220px; }
	.cta-copy h3 { font-size: 18px; font-weight: 800; }
	.cta-copy p { margin-top: 6px; font-size: 12px; color: rgb(255 255 255 / 0.6); }
	.cta-button { position: relative; display: inline-flex; align-items: center; gap: 6px; border-radius: 13px; background: #ededed; color: #050505; padding: 11px 16px; font-size: 12px; font-weight: 800; }
	.help-footer { position: relative; z-index: 1; display: flex; max-width: 1240px; margin: 0 auto; justify-content: space-between; padding: 24px; font-size: 11px; color: var(--text-tertiary); }
	.help-footer a:hover { color: #fff; }
	@media (max-width: 640px) { .hero-icon { width: 62px; height: 62px; border-radius: 18px; } .hero-main { margin-top: 26px; } .answer { padding-left: 22px; } }
</style>
