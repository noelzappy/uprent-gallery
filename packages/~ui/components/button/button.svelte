<script lang="ts">
  import { onMount } from 'svelte'
  import { LoadingSpinnerSVG } from '~ui/assets'
  import Animated from './animated.svelte'

  export let className: string = '',
    loading = false,
    primary = false,
    subtle = false,
    disabled = false,
    onClick: ((e: MouseEvent) => void) | undefined = undefined,
    hotkey: string | undefined = undefined,
    /*
     * Callback to be called when a hotkey is pressed. If the returned value is
     * `true`, the button's `on:click` handler will be executed as well
     */
    onHotkeyPressed: (() => boolean) | undefined = undefined
  export { className as class }

  let button: HTMLButtonElement

  $: loadingClass = `${primary ? '!.bg-primary-300' : '!.bg-black-300'} !.cursor-wait`
  $: loadingClassSubtle = `${primary ? '!.bg-primary-100' : '!.bg-black-100'} !.cursor-wait`

  $: disabledClass = `${primary ? '!.bg-primary-300' : '!.bg-black-300'} !.cursor-not-allowed`
  $: disabledClassSubtle = `${primary ? '!.bg-primary-100 !.text-primary-300' : '!.bg-black-100 !.text-black/50'} !.cursor-not-allowed`

  $: filledClass = `${primary ? '.bg-primary-950 hover:.bg-primary focus:.bg-primary active:.bg-primary' : '.bg-black-950 hover:.bg-black focus:.bg-black active:.bg-black'} .text-white`
  $: subtleClass = `${primary ? '.bg-primary-100 hover:.bg-primary-200 focus:.bg-primary-200 active:.bg-primary-200' : '.bg-black-100 hover:.bg-black-200 focus:.bg-black-200 active:.bg-black-200'}
    ${primary ? '.text-primary' : '.text-black'}`

  const clickButtonOnHotkeyPressed = (e: KeyboardEvent) => {
    if (e.key !== hotkey) return

    const eventTarget = e.target as HTMLInputElement | null

    const isInputField =
      eventTarget?.tagName === 'INPUT' ||
      eventTarget?.tagName === 'TEXTAREA' ||
      eventTarget?.isContentEditable

    if (isInputField) return

    const proceedWithClick = onHotkeyPressed?.()
    proceedWithClick && button.click()
  }

  onMount(() => {
    if (button && hotkey) {
      window.addEventListener('keydown', clickButtonOnHotkeyPressed)
      return () =>
        window.removeEventListener('keydown', clickButtonOnHotkeyPressed)
    }
  })
</script>

<button
  bind:this={button}
  class="{className}
    {loading && (subtle ? loadingClassSubtle : loadingClass)}
    {disabled && (subtle ? disabledClassSubtle : disabledClass)}
    {subtle ? subtleClass : filledClass}
    uprent .flex .h-9 .items-center .justify-center .gap-1.5 .whitespace-nowrap .rounded-md .border-0 .px-4 .text-sm .font-medium .tracking-wide"
  {disabled}
  on:click={e => !disabled && !loading && onClick?.(e)}
  {...$$restProps}
>
  {#if loading}
    <LoadingSpinnerSVG />
  {:else}
    <slot name="icon" />
  {/if}
  <slot {Animated} />
</button>

<style lang="postcss">
  button > :global(svg) {
    height: 1.15em;
    width: 1.15em;
    stroke-width: 2;
    flex-shrink: 0;
  }
  button > :global(*) {
    position: relative;
  }
</style>
