<script lang="ts">
	let { size = 28, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 100 100"
	class="block shrink-0 {className}"
	fill="currentColor"
	aria-hidden="true"
>
	<mask id="brand-logo-mask">
		<rect width="100" height="100" fill="black" />
		<path
			d="M36 18c-7 0-12 5-12 12v40c0 7 5 12 12 12 4 0 7-3 7-7V25c0-4-3-7-7-7z"
			fill="white"
		/>
		<path
			d="M50 16c-4 0-7 3-7 7v54c0 4 3 7 7 7 3 0 5-2 7-4l27-16c5-3 8-7 8-13s-3-10-8-13L57 20c-2-2-4-4-7-4z"
			fill="white"
		/>
		<path d="M52 38l24 12-24 12z" fill="black" />
	</mask>
	<rect width="100" height="100" mask="url(#brand-logo-mask)" />
</svg>
