<script lang="ts">
	import HelpTopbar from '#lib/components/HelpTopbar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { helpCategories } from '#lib/data/help';

	let query = $state('');
	const categories = $derived(
		helpCategories.filter((item) =>
			`${item.title} ${item.short} ${item.description}`.toLowerCase().includes(query.toLowerCase())
		)
	);

	const popular = [
		{ question: 'Почему качество видео не 1080p?', slug: 'uploads', icon: 'chart', gradient: 'linear-gradient(120deg, #243343, #0c1118)' },
		{ question: 'Как включить субтитры?', slug: 'uploads', icon: 'captions', gradient: 'linear-gradient(120deg, #3a2b1c, #140e08)' },
		{ question: 'Что делать при блокировке ролика?', slug: 'safety', icon: 'lock', gradient: 'linear-gradient(120deg, #3a2222, #150a0a)' }
	];
</script>

<svelte:head>
	<title>Центр помощи — VueTube</title>
</svelte:head>

<HelpTopbar />

<div class="help-root">
	<div class="glow glow-a"></div>
	<div class="glow glow-b"></div>

	<section class="hero">
		<div class="hero-inner">
			<div class="hero-copy">
				<p class="eyebrow"><span class="eyebrow-dot"></span> ПОМОЩЬ VUETUBE</p>
				<h1 class="font-display">Всё, что нужно знать<br />о VueTube</h1>
				<p class="hero-text">Ответы на вопросы о видео, Shorts, эфирах, аккаунте и безопасности. Найдите нужный раздел или задайте поиск.</p>
			</div>
			<div class="hero-art" aria-hidden="true">
				<div class="art-ring ring-one"></div>
				<div class="art-ring ring-two"></div>
				<div class="art-core"><Icon name="info" size={58} strokeWidth={1.8} /></div>
				<div class="art-chip chip-one"><Icon name="film" size={18} /></div>
				<div class="art-chip chip-two"><Icon name="monitor" size={18} /></div>
				<div class="art-chip chip-three"><Icon name="lock" size={18} /></div>
			</div>
		</div>
		<div class="hero-search">
			<Icon name="search" size={22} />
			<input bind:value={query} placeholder="Поиск по разделам и вопросам" aria-label="Поиск по справке" />
			{#if query}<button onclick={() => (query = '')} aria-label="Очистить"><Icon name="x" size={18} /></button>{/if}
			<span class="search-hint">Enter</span>
		</div>
	</section>

	<div class="content">
		<section class="block">
			<div class="block-head">
				<div>
					<h2 class="font-display">Часто ищут</h2>
					<p>Быстрые ответы на популярные вопросы</p>
				</div>
			</div>
			<div class="popular-grid">
				{#each popular as item (item.question)}
					<a href="/help/{item.slug}" class="popular-card" style="--card-bg:{item.gradient}">
						<span class="popular-icon"><Icon name={item.icon} size={21} /></span>
						<span class="popular-question">{item.question}</span>
						<Icon name="chevronRight" size={17} class="popular-arrow" />
					</a>
				{/each}
			</div>
		</section>

		<section class="block">
			<div class="block-head">
				<div>
					<h2 class="font-display">Разделы справки</h2>
					<p>{categories.length} разделов · {helpCategories.reduce((sum, c) => sum + c.faq.length, 0)} вопросов</p>
				</div>
			</div>
			<div class="category-grid">
				{#each categories as category (category.slug)}
					<a href="/help/{category.slug}" class="category-card" style="--card-bg:{category.gradient}; --card-glow:{category.glow}">
						<div class="category-orb"></div>
						<div class="category-top">
							<span class="category-icon"><Icon name={category.icon} size={30} /></span>
							<span class="category-count">{category.faq.length} вопросов</span>
						</div>
						<div class="category-bottom">
							<h3 class="font-display">{category.title}</h3>
							<p>{category.short}</p>
							<span class="category-link">Открыть раздел <Icon name="chevronRight" size={15} /></span>
						</div>
					</a>
				{/each}
			</div>
			{#if !categories.length}<p class="empty">По вашему запросу ничего не найдено</p>{/if}
		</section>

		<section class="cta">
			<div class="cta-glow"></div>
			<div class="cta-icon"><Icon name="sparkles" size={26} /></div>
			<div class="cta-copy">
				<h3 class="font-display">Остались вопросы?</h3>
				<p>Правила модерации, авторские права и порядок обжалования — в разделе «Безопасность».</p>
			</div>
			<a href="/help/safety" class="cta-button">Открыть раздел <Icon name="chevronRight" size={16} /></a>
		</section>
	</div>

	<footer class="help-footer">
		<span>VueTube Help · Центр помощи</span>
		<a href="/">Вернуться на VueTube</a>
	</footer>
</div>

<style>
	.help-root { position: relative; min-height: calc(100vh - 58px); overflow: hidden; background: var(--bg); }
	.glow { position: absolute; border-radius: 999px; filter: blur(120px); pointer-events: none; }
	.glow-a { width: 700px; height: 700px; top: -320px; left: -200px; background: rgb(255 255 255 / 0.06); }
	.glow-b { width: 600px; height: 600px; top: 480px; right: -280px; background: rgb(255 255 255 / 0.035); }

	.hero { position: relative; overflow: hidden; background: linear-gradient(115deg, #2c2c2c 0%, #131313 52%, #070707 100%); }
	.hero::after { content: ''; position: absolute; inset: 0; background: radial-gradient(60% 120% at 85% 20%, rgb(255 255 255 / 0.13), transparent 60%); pointer-events: none; }
	.hero-inner { position: relative; z-index: 1; display: flex; max-width: 1280px; margin: 0 auto; align-items: center; justify-content: space-between; gap: 40px; min-height: 330px; padding: 52px 24px 76px; }
	.hero-copy { max-width: 700px; }
	.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: rgb(255 255 255 / 0.55); }
	.eyebrow-dot { width: 7px; height: 7px; border-radius: 999px; background: #fff; box-shadow: 0 0 14px rgb(255 255 255 / 0.9); }
	h1 { margin-top: 18px; font-size: clamp(34px, 4.4vw, 56px); line-height: 1.04; font-weight: 800; letter-spacing: -0.045em; }
	.hero-text { max-width: 560px; margin-top: 18px; font-size: 14px; line-height: 1.7; color: rgb(255 255 255 / 0.66); }
	.hero-art { position: relative; width: 260px; height: 220px; flex-shrink: 0; }
	.art-ring { position: absolute; border-radius: 999px; border: 1px solid rgb(255 255 255 / 0.09); }
	.ring-one { inset: 18px; }
	.ring-two { inset: 48px; }
	.art-core { position: absolute; inset: 76px; display: flex; align-items: center; justify-content: center; border-radius: 26px; background: linear-gradient(150deg, rgb(255 255 255 / 0.2), rgb(255 255 255 / 0.05)); box-shadow: 0 20px 50px -20px rgb(0 0 0 / 0.9), 0 0 50px -15px rgb(255 255 255 / 0.25); }
	.art-chip { position: absolute; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 14px; background: rgb(255 255 255 / 0.09); box-shadow: 0 10px 25px -12px rgb(0 0 0 / 0.9); animation: float 6s ease-in-out infinite; }
	.chip-one { top: 10px; left: 6px; }
	.chip-two { top: 40px; right: 0; animation-delay: -2s; }
	.chip-three { bottom: 16px; left: 26px; animation-delay: -4s; }
	@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }

	.hero-search { position: relative; z-index: 2; display: flex; max-width: 900px; margin: -46px auto 0; align-items: center; gap: 14px; height: 64px; border-radius: 20px; background: rgb(18 18 18 / 0.96); padding: 0 20px; box-shadow: 0 26px 70px -26px rgb(0 0 0 / 0.95), 0 0 50px -30px rgb(255 255 255 / 0.25); backdrop-filter: blur(24px); }
	.hero-search input { flex: 1; height: 100%; font-size: 15px; background: transparent; outline: none; }
	.hero-search button { color: var(--text-tertiary); }
	.search-hint { border-radius: 8px; background: rgb(255 255 255 / 0.07); padding: 4px 8px; font-size: 10px; font-weight: 700; color: var(--text-tertiary); }

	.content { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 56px 24px 60px; }
	.block + .block { margin-top: 54px; }
	.block-head h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
	.block-head p { margin-top: 6px; font-size: 12px; color: var(--text-tertiary); }
	.popular-grid { display: grid; gap: 14px; margin-top: 20px; grid-template-columns: repeat(1, minmax(0, 1fr)); }
	@media (min-width: 800px) { .popular-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
	.popular-card { position: relative; display: flex; min-height: 92px; align-items: center; gap: 14px; overflow: hidden; border-radius: 18px; background: var(--card-bg); padding: 16px 18px; transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease; }
	.popular-card::after { content: ''; position: absolute; inset: 0; background: radial-gradient(80% 140% at 100% 0%, rgb(255 255 255 / 0.13), transparent 60%); pointer-events: none; }
	.popular-card:hover { transform: translateY(-4px); box-shadow: 0 22px 45px -22px rgb(0 0 0 / 0.95); }
	.popular-icon { display: inline-flex; flex-shrink: 0; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: 13px; background: rgb(255 255 255 / 0.12); }
	.popular-question { position: relative; z-index: 1; flex: 1; font-size: 13px; font-weight: 700; line-height: 1.4; }
	.popular-arrow { position: relative; z-index: 1; color: rgb(255 255 255 / 0.6); }

	.category-grid { display: grid; gap: 16px; margin-top: 20px; grid-template-columns: repeat(1, minmax(0, 1fr)); }
	@media (min-width: 760px) { .category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	.category-card { position: relative; display: flex; min-height: 236px; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 24px; background: var(--card-bg); padding: 22px 24px; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease; }
	.category-card::after { content: ''; position: absolute; inset: 0; background: radial-gradient(85% 120% at 90% 5%, var(--card-glow), transparent 60%); pointer-events: none; }
	.category-card:hover { transform: translateY(-6px) scale(1.005); box-shadow: 0 30px 70px -30px rgb(0 0 0 / 0.95); }
	.category-orb { position: absolute; width: 240px; height: 240px; right: -90px; bottom: -150px; border-radius: 999px; background: var(--card-glow); filter: blur(50px); pointer-events: none; }
	.category-top, .category-bottom { position: relative; z-index: 1; }
	.category-top { display: flex; align-items: flex-start; justify-content: space-between; }
	.category-icon { display: inline-flex; width: 62px; height: 62px; align-items: center; justify-content: center; border-radius: 20px; background: linear-gradient(150deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0.06)); box-shadow: 0 16px 36px -16px rgb(0 0 0 / 0.9); }
	.category-count { border-radius: 999px; background: rgb(0 0 0 / 0.35); padding: 5px 10px; font-size: 10px; font-weight: 700; backdrop-filter: blur(10px); }
	.category-bottom h3 { font-size: 23px; font-weight: 800; letter-spacing: -0.02em; }
	.category-bottom p { max-width: 380px; margin-top: 8px; font-size: 12px; line-height: 1.6; color: rgb(255 255 255 / 0.65); }
	.category-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 18px; font-size: 11px; font-weight: 800; color: rgb(255 255 255 / 0.85); }
	.empty { margin-top: 30px; padding: 50px; text-align: center; color: var(--text-tertiary); }

	.cta { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 18px; overflow: hidden; margin-top: 56px; border-radius: 26px; background: linear-gradient(110deg, #2a2a2a, #111); padding: 26px 28px; }
	.cta-glow { position: absolute; width: 340px; height: 340px; right: -120px; top: -180px; border-radius: 999px; background: rgb(255 255 255 / 0.12); filter: blur(70px); }
	.cta-icon { position: relative; display: inline-flex; width: 56px; height: 56px; align-items: center; justify-content: center; border-radius: 18px; background: rgb(255 255 255 / 0.1); }
	.cta-copy { position: relative; flex: 1; min-width: 220px; }
	.cta-copy h3 { font-size: 19px; font-weight: 800; }
	.cta-copy p { margin-top: 6px; font-size: 12px; line-height: 1.6; color: rgb(255 255 255 / 0.6); }
	.cta-button { position: relative; display: inline-flex; align-items: center; gap: 6px; border-radius: 13px; background: #ededed; color: #050505; padding: 11px 16px; font-size: 12px; font-weight: 800; }
	.help-footer { position: relative; z-index: 1; display: flex; max-width: 1280px; margin: 0 auto; justify-content: space-between; padding: 24px; font-size: 11px; color: var(--text-tertiary); }
	.help-footer a:hover { color: #fff; }
	@media (max-width: 760px) { .hero-art { display: none; } .hero-inner { min-height: 260px; padding-bottom: 70px; } }
</style>
