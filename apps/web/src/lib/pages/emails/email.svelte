<script lang="ts">
  import { emailsState } from '$lib/shared/state'
  import {
    TrashSVG,
    EyeOffSVG,
    PaperclipSVG,
    DownloadSVG,
    EyeSVG,
  } from '~ui/assets'
  import dayjs from 'dayjs'
  import api, { API_URL } from '~api'
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
      attachments = []
    }
  })
</script>

<div class=".flex .h-full .w-full .flex-col .overflow-hidden .bg-white">
  {#if loadingError}
    <div
      class=".flex .h-full .items-center .justify-center .p-4 .text-center .text-red-500"
    >
      {loadingError}
    </div>
  {:else if email}
    <div
      class=".flex .flex-row .items-center .justify-between .gap-3 .border-b .border-gray-200 .px-3 .py-3 sm:.flex-col sm:.items-start"
    >
      <div class=".flex .items-center .gap-2">
        <button
          class=".hidden .items-center .gap-1 .rounded-md .px-2 .py-1.5 .text-sm .font-medium .text-gray-700 hover:.bg-gray-100 sm:.flex"
          onclick={() => {
            emailsState.activeEmailHeader = undefined
          }}
          title="Back to inbox"
        >
          <span>←</span>
          <span>Inbox</span>
        </button>
        <button
          class=".flex .items-center .gap-1.5 .rounded-md .px-2 .py-1.5 .text-sm .font-medium .text-gray-700 hover:.bg-gray-100 sm:.gap-2 sm:.px-3"
          onclick={() => {
            email &&
              (email.seen
                ? markEmailAsUnseen(email.uid)
                : markEmailAsSeen(email.uid))
          }}
          title="Mark as Unseen"
        >
          {#if email.seen}
            <EyeOffSVG class=".h-4 .w-4" />
          {:else}
            <EyeSVG class=".h-4 .w-4" />
          {/if}
          <span class=".inline sm:.hidden">Mark Unseen</span>
        </button>
        <button
          class=".flex .items-center .gap-1.5 .rounded-md .px-2 .py-1.5 .text-sm .font-medium .text-red-600 hover:.bg-red-50 sm:.gap-2 sm:.px-3"
          onclick={() => email && deleteEmail(email.uid)}
          title="Delete Email"
        >
          <TrashSVG class=".h-4 .w-4" />
          <span class=".inline sm:.hidden">Delete</span>
        </button>
      </div>
      <div class=".text-xs .text-gray-500 sm:.text-sm">
        {dayjs(email.datetime).format('MMM D, YYYY, HH:mm')}
      </div>
    </div>

    <div class=".flex-1 .overflow-y-auto .p-4 sm:.p-6">
      <div class=".mb-4 sm:.mb-6">
        <h1 class=".mb-2 .text-xl .font-bold .text-gray-900 sm:.text-2xl">
          {email.subject}
        </h1>
        <div class=".flex .items-center .justify-between">
          <div class=".flex .items-center .gap-2">
            <div
              class=".text-primary-700 .flex .h-8 .w-8 .items-center .justify-center .rounded-full .bg-primary-100 .text-sm .font-bold sm:.h-10 sm:.w-10 sm:.text-base"
            >
              {(email.from.name || email.from.email)[0].toUpperCase()}
            </div>
            <div class=".min-w-0">
              <div class=".truncate .font-medium .text-gray-900">
                {email.from.name || email.from.email}
              </div>
              <div class=".truncate .text-xs .text-gray-500 sm:.text-sm">
                &lt;{email.from.email}&gt;
              </div>
            </div>
          </div>
        </div>
      </div>

      {#if attachments.length > 0}
        <div
          class=".mb-4 .border-b .border-t .border-gray-200 .py-3 sm:.mb-6 sm:.py-4"
        >
          <div
            class=".mb-2 .flex .items-center .gap-2 .text-xs .font-medium .text-gray-700 sm:.text-sm"
          >
            <PaperclipSVG class=".h-4 .w-4" />
            {attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}
          </div>
          <div class=".flex .flex-row .flex-wrap .gap-2 sm:.flex-col">
            {#each attachments as attachment}
              <a
                href={`${API_URL}/emails/attachment/${attachment.id}`}
                target="_blank"
                class=".flex .items-center .gap-2 .rounded-md .border .border-gray-200 .bg-gray-50 .px-3 .py-2 .text-xs .text-gray-700 hover:.bg-gray-100 sm:.text-sm"
              >
                <span class=".max-w-[150px] .flex-1 .truncate sm:.max-w-[200px]"
                  >{attachment.filename}</span
                >
                <span class=".whitespace-nowrap .text-xs .text-gray-500"
                  >({Math.round((attachment.size || 0) / 1024)} KB)</span
                >
                <DownloadSVG class=".h-4 .w-4 .shrink-0 .text-gray-400" />
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <div class=".prose .prose-sm sm:.prose-base .max-w-none .text-gray-800">
        {@html email.content}
      </div>
    </div>
  {:else if loadingEmailContent}
    <div
      class=".flex .h-full .items-center .justify-center .p-4 .text-gray-500"
    >
      Loading...
    </div>
  {:else}
    <div
      class=".flex .h-full .flex-col .items-center .justify-center .p-4 .text-gray-500"
    >
      <div class=".mb-4 .rounded-full .bg-gray-100 .p-4 sm:.p-6">
        <PaperclipSVG class=".h-8 .w-8 .text-gray-400 sm:.h-12 sm:.w-12" />
      </div>
      <p class=".text-center .text-base .font-medium sm:.text-lg">
        Select an email to view its content
      </p>
    </div>
  {/if}
</div>
