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
  <div class=".my-5 .flex .items-center .justify-center .py-4 sm:.my-3">
    <button
      class=".rounded .bg-gray-200 .px-4 .py-2 .text-sm .font-medium .text-gray-700 hover:.bg-gray-300 sm:.text-xs"
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
  <div
    class=".my-3 .flex .items-center .justify-center .py-4 .text-xs .text-gray-500 sm:.my-5 sm:.text-sm"
  >
    No more emails to load.
  </div>
{/if}
