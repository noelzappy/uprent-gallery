<script lang="ts">
  import dayjs from 'dayjs'
  import type { Email } from '~core/database'

  let { email }: { email: Email } = $props()
</script>

<div
  class=".flex .w-full .min-w-0 .flex-col .justify-between .gap-3 .px-4 .py-3 .text-left hover:.bg-gray-200"
>
  <span class=".flex .items-start .justify-between">
    <span class=".mr-2 .flex .items-center .gap-1.5 .truncate .font-medium">
      {email.subject}
    </span>
    <span class=".min-w-fit .whitespace-nowrap .text-xs .text-gray-500">
      {dayjs(email.datetime).format('MMM D, HH:mm')}
    </span>
  </span>

  <span class=".flex .items-center .justify-between">
    <span class=".truncate .text-sm .text-gray-600">
      From
      {email.from.name || email.from.email}
    </span>
  </span>

  <span class=".max-h-32 .overflow-hidden .text-ellipsis .whitespace-pre-wrap">
    {@html email.content}
  </span>
</div>
