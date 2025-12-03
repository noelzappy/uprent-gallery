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
  {#if loadingEmailContent}
    <div class=".flex .h-full .items-center .justify-center .text-gray-500">
      Loading...
    </div>
  {:else if loadingError}
    <div class=".flex .h-full .items-center .justify-center .text-red-500">
      {loadingError}
    </div>
  {:else if email}
    <div
      class=".flex .items-center .justify-between .border-b .border-gray-200 .px-6 .py-4"
    >
      <div class=".flex .items-center .gap-2">
        <button
          class=".flex .items-center .gap-2 .rounded-md .px-3 .py-1.5 .text-sm .font-medium .text-gray-700 hover:.bg-gray-100"
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
          <span class=".hidden sm:.inline">Mark Unseen</span>
        </button>
        <button
          class=".flex .items-center .gap-2 .rounded-md .px-3 .py-1.5 .text-sm .font-medium .text-red-600 hover:.bg-red-50"
          onclick={() => email && deleteEmail(email.uid)}
          title="Delete Email"
        >
          <TrashSVG class=".h-4 .w-4" />
          <span class=".hidden sm:.inline">Delete</span>
        </button>
      </div>
      <div class=".text-sm .text-gray-500">
        {dayjs(email.datetime).format('MMM D, YYYY, HH:mm')}
      </div>
    </div>

    <div class=".flex-1 .overflow-y-auto .p-6">
      <div class=".mb-6">
        <h1 class=".mb-2 .text-2xl .font-bold .text-gray-900">
          {email.subject}
        </h1>
        <div class=".flex .items-center .justify-between">
          <div class=".flex .items-center .gap-2">
            <div
              class=".text-primary-700 .flex .h-10 .w-10 .items-center .justify-center .rounded-full .bg-primary-100 .font-bold"
            >
              {(email.from.name || email.from.email)[0].toUpperCase()}
            </div>
            <div>
              <div class=".font-medium .text-gray-900">
                {email.from.name || email.from.email}
              </div>
              <div class=".text-sm .text-gray-500">
                &lt;{email.from.email}&gt;
              </div>
            </div>
          </div>
        </div>
      </div>

      {#if attachments.length > 0}
        <div class=".mb-6 .border-b .border-t .border-gray-200 .py-4">
          <div
            class=".mb-2 .flex .items-center .gap-2 .text-sm .font-medium .text-gray-700"
          >
            <PaperclipSVG class=".h-4 .w-4" />
            {attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}
          </div>
          <div class=".flex .flex-wrap .gap-2">
            {#each attachments as attachment}
              <a
                href={`${API_URL}/emails/attachment/${attachment.id}`}
                target="_blank"
                class=".flex .items-center .gap-2 .rounded-md .border .border-gray-200 .bg-gray-50 .px-3 .py-2 .text-sm .text-gray-700 hover:.bg-gray-100"
              >
                <span class=".max-w-[200px] .truncate"
                  >{attachment.filename}</span
                >
                <span class=".text-xs .text-gray-500"
                  >({Math.round((attachment.size || 0) / 1024)} KB)</span
                >
                <DownloadSVG class=".h-4 .w-4 .text-gray-400" />
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <div class=".prose .max-w-none .text-gray-800">
        {@html email.content}
      </div>
    </div>
  {:else}
    <div
      class=".flex .h-full .flex-col .items-center .justify-center .text-gray-500"
    >
      <div class=".mb-4 .rounded-full .bg-gray-100 .p-6">
        <PaperclipSVG class=".h-12 .w-12 .text-gray-400" />
      </div>
      <p class=".text-lg .font-medium">Select an email to view its content</p>
    </div>
  {/if}
</div>
