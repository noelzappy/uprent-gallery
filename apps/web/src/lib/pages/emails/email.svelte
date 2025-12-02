<script lang="ts">
  import { emailsState } from '$lib/shared/state'
  import dayjs from 'dayjs'
  import api from '~api'
  import type { Email, EmailHeader } from '~core/database'

  let email = $state<Email | null>(null)

  let activeEmailHeader = $derived(emailsState.activeEmailHeader)
  let loadingEmailContent = $state(false)
  let loadingError = $state<string | null>(null)
  let currentlyLoadingUid = $state<number | null>(null)

  const fetchActiveEmailContent = async (emailHeader: EmailHeader) => {
    if (currentlyLoadingUid === emailHeader.uid) {
      return
    }

    const cached = emailsState.cachedEmailContents[emailHeader.uid]
    if (cached) {
      email = cached
      loadingEmailContent = false
      loadingError = null
      return
    }

    currentlyLoadingUid = emailHeader.uid
    email = null
    loadingEmailContent = true
    loadingError = null

    const { data, error } = await api.emails
      .content({ uid: emailHeader.uid })
      .get()

    if (currentlyLoadingUid !== emailHeader.uid) {
      return
    }

    currentlyLoadingUid = null
    loadingEmailContent = false

    if (error) {
      email = null
      loadingError = error.value?.message || 'An unknown error occurred.'
      return
    }

    email = data?.payload?.email ?? null
    if (email) {
      emailsState.cachedEmailContents[emailHeader.uid] = email
    }
  }

  $effect(() => {
    if (activeEmailHeader) {
      fetchActiveEmailContent(activeEmailHeader)
    } else {
      email = null
      loadingEmailContent = false
      loadingError = null
      currentlyLoadingUid = null
    }
  })
</script>

<div
  class=".text-lef .flex .w-full .min-w-0 .flex-col .justify-between .gap-3 .px-4 .py-3"
>
  {#if loadingEmailContent}
    <span>Loading...</span>
  {:else if loadingError}
    <span class="text-red-500">{loadingError}</span>
  {:else if email}
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

    <span
      class=".max-h-32 .overflow-hidden .text-ellipsis .whitespace-pre-wrap"
    >
      {@html email.content}
    </span>
  {:else}
    <span class="text-gray-500">Select an email to view its content.</span>
  {/if}
</div>
