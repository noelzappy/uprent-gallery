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
  class=".flex .w-full .min-w-0 .cursor-pointer .flex-col .justify-between .gap-3 .px-4 .py-3 .text-left {isActive
    ? '.bg-primary-100'
    : 'hover:.bg-gray-200'}"
  onclick={onSelectHeader}
>
  <span class=".flex .items-start .justify-between">
    <span
      class=".mr-2 .flex .items-center .gap-1.5 .truncate {isUnseen
        ? '.font-bold .text-black'
        : '.font-medium'}"
    >
      {#if isUnseen}
        <span class=".h-2 .w-2 .shrink-0 .rounded-full .bg-primary"></span>
      {/if}
      {header.subject}
    </span>
    <span
      class=".min-w-fit .whitespace-nowrap .text-xs {isUnseen
        ? '.font-semibold .text-primary'
        : '.text-gray-500'}"
    >
      {dayjs(header.datetime).format('MMM D, HH:mm')}
    </span>
  </span>

  <span class=".flex .items-center .justify-between">
    <span
      class=".truncate .text-sm {isUnseen
        ? '.font-semibold .text-gray-900'
        : '.text-gray-600'}"
    >
      From
      {header.from.name || header.from.email}
    </span>
  </span>
</button>
