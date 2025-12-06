<script lang="ts">
  import { emailsState } from '$lib/shared/state'
  import dayjs from 'dayjs'
  import type { Email } from '~core/database'

  let { header }: { header: Omit<Email, 'content'> } = $props()

  let isActive = $derived(emailsState.activeEmailHeader?.uid === header.uid)
  let isUnseen = $derived(!header.seen)

  const onSelectHeader = () => {
    emailsState.activeEmailHeader = header
  }
</script>

<button
  class=".flex .w-full .min-w-0 .cursor-pointer .flex-col .justify-between .gap-2 .px-3 .py-2.5 .text-left sm:.gap-3 sm:.px-4 sm:.py-3 {isActive
    ? '.bg-primary-100'
    : 'hover:.bg-gray-200'}"
  onclick={onSelectHeader}
>
  <span class=".flex .items-start .justify-between .gap-2">
    <span
      class=".flex .min-w-0 .flex-1 .items-center .gap-1.5 {isUnseen
        ? '.font-bold .text-black'
        : '.font-medium'}"
    >
      {#if isUnseen}
        <span class=".h-2 .w-2 .shrink-0 .rounded-full .bg-primary"></span>
      {/if}
      <span class=".truncate .text-sm sm:.text-base">{header.subject}</span>
    </span>
    <span
      class=".shrink-0 .whitespace-nowrap .text-xs {isUnseen
        ? '.font-semibold .text-primary'
        : '.text-gray-500'}"
    >
      {dayjs(header.datetime).format('MMM D, HH:mm')}
    </span>
  </span>

  <span class=".flex .items-center .justify-between">
    <span
      class=".truncate .text-sm .text-gray-600 md:.text-xs {isUnseen
        ? '.font-semibold .text-gray-900'
        : ''}"
    >
      From
      {header.from.name || header.from.email}
    </span>
  </span>
</button>
