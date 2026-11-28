<div class="min-w-0" aria-hidden="true">
	<div class="skeleton aspect-video w-full rounded-[16px]"></div>
	<div class="mt-3 flex gap-2.5">
		<div class="skeleton h-9 w-9 shrink-0 rounded-full"></div>
		<div class="min-w-0 flex-1 space-y-2">
			<div class="skeleton h-3.5 w-[94%] rounded-md"></div>
			<div class="skeleton h-3.5 w-[68%] rounded-md"></div>
			<div class="skeleton h-3 w-[44%] rounded-md"></div>
		</div>
	</div>
</div>

<style>
	.skeleton {
		position: relative;
		overflow: hidden;
		background: var(--skeleton);
		animation: skeleton-pulse 1.6s ease-in-out infinite;
	}

	.skeleton::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.07), transparent);
		transform: translateX(-100%);
		animation: skeleton-shimmer 1.5s linear infinite;
	}

	@keyframes skeleton-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@keyframes skeleton-shimmer {
		to {
			transform: translateX(100%);
		}
	}
</style>
