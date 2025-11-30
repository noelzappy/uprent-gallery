<script lang="ts">
  import { emailsState } from '$lib/shared/state'
  import Email from './email.svelte'
  import { LoadingSpinnerSVG } from '~ui/assets'
  import { onMount } from 'svelte'
  import api from '~api'

  let loading = $state(true)

  onMount(async () => {
    const { data, error } = await api.emails.load.get()
    loading = false

    if (error) {
      console.error(error.value)
      return
    }

    emailsState.allEmails = data.payload.emails
  })
</script>

<div class=".absolute .inset-0 .flex .flex-col .overflow-y-auto sm:.pb-16">
  {#if loading}
    <div class=".flex .h-20 .items-center .justify-center .text-gray-500">
      <div class=".flex .items-center .gap-2">
        <LoadingSpinnerSVG class=".h-4 .w-4 .shrink-0 .text-primary" />
        Fetching emails...
      </div>
    </div>
  {:else}
    {#each emailsState.allEmails as email}
      <Email {email} />
    {/each}
  {/if}
</div>
