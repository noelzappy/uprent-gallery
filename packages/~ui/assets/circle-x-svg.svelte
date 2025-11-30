<script lang="ts">
  export let className: string = ''
  export { className as class }
</script>

<svg
  class={className}
  stroke-width="1.5"
  fill="none"
  viewBox="0 0 24 24"
  stroke-linecap="round"
  stroke-linejoin="round"
  stroke="currentColor"
  height="1.35em"
  width="1.35em"
>
  <circle cx="12" cy="12" r="11" />
  <path d="M9 9l6 6m0 -6l-6 6" />
</svg>
