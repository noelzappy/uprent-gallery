<script lang="ts">
  import { emailsState } from '$lib/shared/state'
  import { LoadingSpinnerSVG, AlertTriangleSVG, EmailSVG } from '~ui/assets'
  import { onMount } from 'svelte'
  import api from '~api'
  import EmailHeader from './email-header.svelte'
  import PaginationBtn from './pagination-btn.svelte'
  import Email from './email.svelte'

  let loading = $state(true)
  let syncing = $state(false)
  let emailError = $state<string | null>(null)
  let paging = $state<{ cursor: number; hasMore: boolean }>({
    cursor: 0,
    hasMore: true,
  })

  let sortedHeaders = $derived(
    Object.values(emailsState.emailHeaders).sort((a, b) => {
      return new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
    }),
  )

  onMount(() => {
    onLoadEmailHeaders()
    const ws = api.emails.sync.subscribe()
    ws.subscribe(async event => {
      const { data } = event

      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'emailSynced') {
            if (sortedHeaders.length < 5) {
              emailsState.addHeaders([parsed.payload])
            }
          } else if (parsed.type === 'syncComplete') {
            syncing = false
          }
        } catch (e) {
          console.error('Failed to parse WS message', e)
        }
      }
    })

    return () => {
      ws.close()
    }
  })

  const onLoadEmailHeaders = async () => {
    loading = true
    const { data, error } = await api.emails.load.get({
      query: {
        cursor: paging.cursor,
        limit: 5,
      },
    })

    loading = false

    if (error) {
      emailError = error.value?.message || 'An unknown error occurred.'
      return
    }
    emailError = null
    emailsState.addHeaders(data.payload.emails)
    paging = data.payload.paging
  }

  const syncEmails = async () => {
    syncing = true
    await api.emails.sync.post()
  }
</script>

<div
  class=".absolute .inset-0 .mx-auto .flex .max-w-7xl .flex-col .overflow-hidden sm:.pb-16"
>
  {#if loading && sortedHeaders.length === 0}
    <div class=".flex .h-20 .items-center .justify-center .text-gray-500">
      <div class=".flex .items-center .gap-2">
        <LoadingSpinnerSVG class=".h-4 .w-4 .shrink-0 .text-primary" />
        Fetching emails...
      </div>
    </div>
  {:else if emailError}
    <div
      class="py-3 .flex .h-full .flex-col .items-center .justify-center .gap-4 .p-8 .text-center"
    >
      <div class=".rounded-full .bg-red-50 .p-3">
        <AlertTriangleSVG class=".h-8 .w-8 .text-red-500" />
      </div>
      <div class=".max-w-md">
        <h3 class=".text-lg .font-medium .text-gray-900">
          Failed to load emails
        </h3>
        <p class=".mt-1 .text-sm .text-gray-500">{emailError}</p>
      </div>
      <button
        onclick={onLoadEmailHeaders}
        class=".hover:bg-primary/90 .focus:outline-none .focus:ring-2 .focus:ring-primary .focus:ring-offset-2 .rounded-md .bg-primary .px-4 .py-2 .text-sm .font-medium .text-white .shadow-sm"
      >
        Try Again
      </button>
    </div>
  {:else if sortedHeaders.length === 0}
    <div
      class=".flex .h-full .flex-col .items-center .justify-center .gap-4 .p-8 .text-center"
    >
      {#if syncing}
        <div class=".rounded-full .bg-blue-50 .p-3">
          <LoadingSpinnerSVG class=".h-8 .w-8 .animate-spin .text-primary" />
        </div>
        <div class=".max-w-md">
          <h3 class=".text-lg .font-medium .text-gray-900">
            Syncing Emails...
          </h3>
          <p class=".mt-1 .text-sm .text-gray-500">
            We are fetching your emails. They will appear here as soon as they
            are ready.
          </p>
        </div>
      {:else}
        <div class=".rounded-full .bg-gray-100 .p-3">
          <EmailSVG />
        </div>
        <div class=".max-w-md">
          <h3 class=".text-lg .font-medium .text-gray-900">No Emails</h3>
          <p class=".mt-1 .text-sm .text-gray-500">
            You have no emails at the moment. Please check back later.
          </p>
        </div>

        <button
          onclick={syncEmails}
          class=".hover:bg-primary/90 .focus:outline-none .focus:ring-2 .focus:ring-primary .focus:ring-offset-2 .rounded-md .bg-primary .px-4 .py-2 .text-sm .font-medium .text-white .shadow-sm"
        >
          Fetch Emails
        </button>
      {/if}
    </div>
  {:else}
    <div
      class=".flex .h-full .overflow-hidden .rounded-lg .bg-white .shadow-lg"
    >
      <div
        class=".flex .w-1/3 .min-w-[320px] .flex-col .border-r .border-gray-200"
      >
        <div class=".flex-1 .overflow-y-auto">
          {#each sortedHeaders as header}
            <EmailHeader {header} />
          {/each}
          <PaginationBtn {paging} loadMore={onLoadEmailHeaders} {loading} />
        </div>
      </div>

      <div class=".relative .flex .flex-1 .flex-col .bg-[#efeae2]">
        <Email />
      </div>
    </div>
  {/if}
</div>
