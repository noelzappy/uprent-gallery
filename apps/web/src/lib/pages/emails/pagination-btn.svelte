<script lang="ts">
  import { LoadingSpinnerSVG } from '~ui/assets'

  let {
    paging,
    loading,
    loadMore,
  }: {
    paging: { cursor: number; hasMore: boolean }
    loadMore: () => Promise<void>
    loading: boolean
  } = $props()
</script>

{#if paging.hasMore}
  <div class=".my-5 .flex .h-20 .items-center .justify-center">
    <button
      class=".rounded .bg-gray-200 .px-4 .py-2 .text-sm .font-medium .text-gray-700 hover:.bg-gray-300"
      onclick={async () => {
        await loadMore()
      }}
    >
      {#if loading}
        <div class=".flex .items-center .gap-2">
          <LoadingSpinnerSVG class=".h-4 .w-4 .shrink-0 .text-primary" />
          Loading more...
        </div>
      {:else}
        Load more
      {/if}
    </button>
  </div>
{:else}
  <div class=".my-5 .flex .h-20 .items-center .justify-center .text-gray-500">
    No more emails to load.
  </div>
{/if}
