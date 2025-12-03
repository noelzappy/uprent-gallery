<script lang="ts">
  import { emailsState } from '$lib/shared/state'
  import dayjs from 'dayjs'
  import type { Email } from '~core/database'

  let { header }: { header: Email } = $props()

  const onSelectHeader = () => {
    emailsState.activeEmailHeader = header
  }
</script>

<button
  class=".flex .w-full .min-w-0 .cursor-pointer .flex-col .justify-between .gap-3 .px-4 .py-3 .text-left hover:.bg-gray-200"
  onclick={onSelectHeader}
>
  <span class=".flex .items-start .justify-between">
    <span class=".mr-2 .flex .items-center .gap-1.5 .truncate .font-medium">
      {header.subject}
    </span>
    <span class=".min-w-fit .whitespace-nowrap .text-xs .text-gray-500">
      {dayjs(header.datetime).format('MMM D, HH:mm')}
    </span>
  </span>

  <span class=".flex .items-center .justify-between">
    <span class=".truncate .text-sm .text-gray-600">
      From
      {header.from.name || header.from.email}
    </span>
  </span>
</button>
