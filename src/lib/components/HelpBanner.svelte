<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		title,
		description = '',
		icon = 'info',
		eyebrow = 'ЦЕНТР ПОМОЩИ',
		gradient = 'linear-gradient(120deg, #2b2b2b, #0a0a0a)',
		glow = 'rgba(255,255,255,0.2)',
		compact = false
	}: {
		title: string;
		description?: string;
		icon?: string;
		eyebrow?: string;
		gradient?: string;
		glow?: string;
		compact?: boolean;
	} = $props();
</script>

<div class="help-banner" class:compact style="--banner-bg:{gradient}; --banner-glow:{glow}">
	<div class="orb orb-one"></div>
	<div class="orb orb-two"></div>
	<div class="banner-sheen"></div>
	<div class="banner-content">
		<div class="banner-icon"><Icon name={icon} size={compact ? 26 : 42} strokeWidth={2.2} /></div>
		<div class="min-w-0">
			<p class="eyebrow">{eyebrow}</p>
			<h1 class="font-display">{title}</h1>
			{#if description}<p class="banner-desc">{description}</p>{/if}
		</div>
	</div>
</div>

<style>
	.help-banner {
		position: relative;
		overflow: hidden;
		min-height: 214px;
		border-radius: 28px;
		background: var(--banner-bg);
		box-shadow: 0 28px 80px -34px rgb(0 0 0 / 0.95);
	}
	.help-banner.compact { min-height: 150px; border-radius: 20px; }
	.orb { position: absolute; border-radius: 999px; filter: blur(60px); pointer-events: none; }
	.orb-one {
		width: 300px; height: 300px;
		top: -140px; right: 8%;
		background: var(--banner-glow);
	}
	.orb-two {
		width: 220px; height: 220px;
		bottom: -150px; right: 32%;
		background: rgb(255 255 255 / 0.1);
	}
	.banner-sheen {
		position: absolute;
		inset: 0;
		background: linear-gradient(115deg, transparent 35%, rgb(255 255 255 / 0.07) 48%, transparent 62%);
		pointer-events: none;
	}
	.banner-content {
		position: relative;
		z-index: 1;
		display: flex;
		height: 100%;
		min-height: inherit;
		align-items: center;
		gap: 22px;
		padding: 32px 36px;
	}
	.help-banner.compact .banner-content { padding: 24px; gap: 16px; }
	.banner-icon {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 84px; height: 84px;
		border-radius: 24px;
		background: linear-gradient(160deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0.06));
		box-shadow: 0 16px 36px -16px rgb(0 0 0 / 0.9), 0 0 30px -12px var(--banner-glow);
	}
	.help-banner.compact .banner-icon { width: 56px; height: 56px; border-radius: 18px; }
	.eyebrow {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.18em;
		color: rgb(255 255 255 / 0.55);
	}
	h1 {
		margin-top: 8px;
		font-size: 34px;
		line-height: 1.05;
		font-weight: 800;
		letter-spacing: -0.03em;
	}
	.help-banner.compact h1 { font-size: 22px; margin-top: 5px; }
	.banner-desc {
		max-width: 640px;
		margin-top: 10px;
		font-size: 13px;
		line-height: 1.6;
		color: rgb(255 255 255 / 0.68);
	}
	.help-banner.compact .banner-desc { margin-top: 6px; font-size: 12px; }
	@media (max-width: 640px) {
		.banner-content { padding: 24px 20px; gap: 16px; }
		.banner-icon { width: 60px; height: 60px; border-radius: 18px; }
		h1 { font-size: 26px; }
	}
</style>
