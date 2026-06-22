<script lang="ts">
	let { class: className = 'h-8 w-8' }: { class?: string } = $props();
</script>

<svg
	width="48"
	height="48"
	viewBox="0 0 48 48"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	aria-hidden="true"
>
	<defs>
		<linearGradient id="c-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
			<stop offset="0%" stop-color="#1e66f5" />
			<stop offset="100%" stop-color="#89b4fa" />
		</linearGradient>
		<linearGradient id="c-shine" x1="24" y1="0" x2="26" y2="48" gradientUnits="userSpaceOnUse">
			<stop stop-color="white" stop-opacity="0" />
			<stop offset="1" stop-color="white" stop-opacity="0.12" />
		</linearGradient>
		<linearGradient id="c-mark-full" x1="23.8964" y1="9" x2="23.8964" y2="39.0001" gradientUnits="userSpaceOnUse">
			<stop stop-color="white" stop-opacity="0.8" />
			<stop offset="1" stop-color="white" stop-opacity="0.5" />
		</linearGradient>
		<linearGradient id="c-mark-top" x1="23.8964" y1="9" x2="23.8964" y2="24.0001" gradientUnits="userSpaceOnUse">
			<stop stop-color="white" stop-opacity="0.8" />
			<stop offset="1" stop-color="white" stop-opacity="0.5" />
		</linearGradient>
		<linearGradient id="c-mark-bottom" x1="23.8964" y1="39.0002" x2="23.8964" y2="24.0002" gradientUnits="userSpaceOnUse">
			<stop stop-color="white" stop-opacity="0.8" />
			<stop offset="1" stop-color="white" stop-opacity="0.5" />
		</linearGradient>
		<linearGradient id="c-border" x1="24" y1="0" x2="24" y2="48" gradientUnits="userSpaceOnUse">
			<stop stop-color="white" stop-opacity="0.12" />
			<stop offset="1" stop-color="white" stop-opacity="0" />
		</linearGradient>
		<clipPath id="c-clip">
			<rect width="48" height="48" rx="12" fill="white" />
		</clipPath>
	</defs>

	<g clip-path="url(#c-clip)">
		<rect width="48" height="48" rx="12" fill="url(#c-bg)" />
		<rect width="48" height="48" fill="url(#c-shine)" />
		<path
			opacity="0.5"
			d="M24.0001 9C15.7157 9 9 15.7158 9 24.0001C9 32.2844 15.7157 39.0001 24.0001 39.0001C31.4326 39.0001 37.6025 33.5944 38.7927 26.5001H38.6851C37.575 30.8132 33.6597 34.0001 29.0001 34.0001C23.4772 34.0001 19 29.5229 19 24.0001C19 18.4772 23.4772 14 29.0001 14C33.6597 14 37.575 17.187 38.6851 21.5H38.7927C37.6025 14.4057 31.4326 9 24.0001 9Z"
			fill="url(#c-mark-full)"
		/>
		<path
			d="M9 24.0001C9 15.7158 15.7158 9 24.0001 9C31.4326 9 37.6025 14.4057 38.7927 21.5H28.685C27.5749 17.187 23.6597 14 19 14C13.4772 14 9 18.4772 9 24.0001Z"
			fill="url(#c-mark-top)"
		/>
		<path
			d="M9 24.0002C9 32.2845 15.7158 39.0002 24.0001 39.0002C31.4326 39.0002 37.6025 33.5945 38.7927 26.5002H28.685C27.5749 30.8133 23.6597 34.0002 19 34.0002C13.4772 34.0002 9 29.5231 9 24.0002Z"
			fill="url(#c-mark-bottom)"
		/>
	</g>
	<rect x="1" y="1" width="46" height="46" rx="11" stroke="url(#c-border)" stroke-width="2" />
</svg>
