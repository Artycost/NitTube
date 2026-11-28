<script lang="ts">
	let { size = 28, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<img
	src="/shorts-logo.svg?v=29"
	alt=""
	aria-hidden="true"
	width={size}
	height={size}
	class="block shrink-0 object-contain align-middle {className}"
/>
