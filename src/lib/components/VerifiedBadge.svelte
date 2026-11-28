<script lang="ts">
	let {
		size = 14,
		label = 'Верифицированный аккаунт',
		creator = false
	}: {
		size?: number;
		label?: string;
		creator?: boolean;
	} = $props();
</script>

<span class="badge group" style="--badge-size:{size}px" tabindex="0" role="img" aria-label={label}>
	<span class="disc" class:creator>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6.5 12.5l3.6 3.6 7.4-8" />
		</svg>
	</span>
	<span class="tip">{label}</span>
</span>

<style>
	.badge {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--badge-size);
		height: var(--badge-size);
		flex-shrink: 0;
		vertical-align: middle;
		outline: none;
	}

	.disc {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 999px;
		background: var(--text);
		color: var(--bg);
		box-shadow: 0 0 0 2px var(--bg), 0 2px 8px rgb(0 0 0 / 0.35);
		transform-origin: center;
		animation: badge-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
		transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
	}

	.disc.creator {
		background: var(--bg-active);
		color: var(--text);
		box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--border-strong);
	}

	.disc svg {
		width: 74%;
		height: 74%;
		fill: none;
		stroke: currentColor;
		stroke-width: 3.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.badge:hover .disc,
	.badge:focus-visible .disc {
		transform: rotateY(360deg) scale(1.18);
	}

	.tip {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		z-index: 80;
		white-space: nowrap;
		border-radius: 9px;
		background: var(--bg-elevated);
		color: var(--text);
		padding: 6px 10px;
		font-size: 11px;
		font-weight: 600;
		box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.8);
		opacity: 0;
		transform: translateX(-50%) translateY(4px) scale(0.96);
		pointer-events: none;
		transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.badge:hover .tip,
	.badge:focus-visible .tip {
		opacity: 1;
		transform: translateX(-50%) translateY(0) scale(1);
	}

	@keyframes badge-in {
		0% {
			opacity: 0;
			transform: rotateY(-90deg) scale(0.6);
		}
		60% {
			opacity: 1;
			transform: rotateY(12deg) scale(1.12);
		}
		100% {
			opacity: 1;
			transform: rotateY(0) scale(1);
		}
	}
</style>
