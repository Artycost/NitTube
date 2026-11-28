<script lang="ts">
	import Icon from './Icon.svelte';
	import BrandLogo from './BrandLogo.svelte';
</script>

<header class="help-topbar">
	<div class="topbar-inner">
		<a href="/help" class="brand">
			<span class="brand-mark"><BrandLogo size={20} /></span>
			<span class="brand-name">VueTube</span>
			<span class="brand-divider"></span>
			<span class="brand-help">Справка</span>
		</a>
		<div class="topbar-actions">
			<a href="/help" class="top-link"><Icon name="info" size={16} /> Разделы</a>
			<a href="/" class="back-site"><Icon name="arrowLeft" size={16} /> На сайт</a>
		</div>
	</div>
</header>

<style>
	.help-topbar {
		position: sticky;
		top: 0;
		z-index: 50;
		background: rgb(5 5 5 / 0.72);
		backdrop-filter: blur(24px) saturate(160%);
		box-shadow: 0 10px 30px -20px rgb(0 0 0 / 0.9);
	}
	.topbar-inner { max-width: 1240px; margin: 0 auto; height: 58px; display: flex; align-items: center; gap: 16px; padding: 0 20px; }
	.brand { display: flex; align-items: center; gap: 10px; }
	.brand-mark { display: inline-flex; align-items: center; justify-content: center; color: #fff; }
	.brand-name { font-family: var(--font-display); font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
	.brand-divider { height: 16px; width: 1px; background: rgb(255 255 255 / 0.14); }
	.brand-help { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
	.topbar-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
	.top-link, .back-site { display: inline-flex; align-items: center; gap: 6px; border-radius: 11px; padding: 8px 12px; font-size: 12px; font-weight: 700; color: var(--text-secondary); transition: all 0.18s ease; }
	.top-link:hover, .back-site:hover { background: rgb(255 255 255 / 0.07); color: #fff; }
	.back-site { background: rgb(255 255 255 / 0.07); }
	@media (max-width: 560px) { .top-link { display: none; } }
</style>
