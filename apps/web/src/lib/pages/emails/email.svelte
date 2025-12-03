<script lang="ts">
  import { emailsState } from '$lib/shared/state'
  import dayjs from 'dayjs'
  import api from '~api'
  import type { Email } from '~core/database'
  import type { EmailAttachmentDBRecord } from '~core/database/data-types/email'

  let email = $state<Email | null>(null)

  let activeEmailHeader = $derived(emailsState.activeEmailHeader)
  let loadingEmailContent = $state(false)
  let loadingError = $state<string | null>(null)
  let currentlyLoadingUid = $state<number | null>(null)
  let attachments = $state<EmailAttachmentDBRecord[]>([])

  const fetchActiveEmailContent = async (emailUid: number) => {
    if (currentlyLoadingUid === emailUid) {
      return
    }

    const cached = emailsState.cachedEmailContents[emailUid]
    if (cached) {
      email = cached
      loadingEmailContent = false
      loadingError = null
      return
    }

    currentlyLoadingUid = emailUid
    email = null
    loadingEmailContent = true
    loadingError = null

    const { data, error } = await api.emails.content({ uid: emailUid }).get()

    if (currentlyLoadingUid !== emailUid) {
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
      emailsState.cachedEmailContents[emailUid] = {
        ...email,
        seen: true,
      }
    }
    await markEmailAsSeen(emailUid)
  }

  const markEmailAsSeen = async (emailUid: number) => {
    await api.emails.actions({ id: emailUid }).seen.post()
    emailsState.cachedEmailContents[emailUid] = {
      ...emailsState.cachedEmailContents[emailUid],
      seen: true,
    }
    if (emailsState.emailHeaders[emailUid]) {
      emailsState.emailHeaders[emailUid] = {
        ...emailsState.emailHeaders[emailUid],
        seen: true,
      }
    }
  }

  const markEmailAsUnseen = async (emailUid: number) => {
    await api.emails.actions({ id: emailUid }).seen.delete()
    if (emailsState.cachedEmailContents[emailUid]) {
      emailsState.cachedEmailContents[emailUid] = {
        ...emailsState.cachedEmailContents[emailUid],
        seen: false,
      }
    }
    if (emailsState.emailHeaders[emailUid]) {
      emailsState.emailHeaders[emailUid] = {
        ...emailsState.emailHeaders[emailUid],
        seen: false,
      }
    }
  }

  const deleteEmail = async (emailUid: number) => {
    await api.emails.actions({ id: emailUid }).delete()
    if (emailsState.cachedEmailContents[emailUid]) {
      delete emailsState.cachedEmailContents[emailUid]
    }
    if (emailsState.emailHeaders[emailUid]) {
      delete emailsState.emailHeaders[emailUid]
    }
    if (activeEmailHeader?.uid === emailUid) {
      emailsState.activeEmailHeader = undefined
    }
  }

  const fetchEmailAttachment = async (emailUid: number) => {
    const { data, error } = await api.emails
      .content({ uid: emailUid })
      .attachments.get()

    if (error) {
      attachments = []
      return null
    }

    attachments = data?.payload?.attachments || []
  }

  $effect(() => {
    if (activeEmailHeader) {
      fetchActiveEmailContent(activeEmailHeader.uid)
      fetchEmailAttachment(activeEmailHeader.uid)
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
