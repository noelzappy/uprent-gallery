<script lang="ts">
  import { Button } from '~ui/components'
  import {
    XSVG,
    BedSVG,
    BathSVG,
    DimensionsSVG,
    ArmchairSVG,
    CalendarEventSVG,
    CoinEuroSVG,
    PawSVG,
    BoltSVG,
    ExternalLinkSVG,
    RocketSVG,
    ThumbDownSVG,
  } from '~ui/assets'
  import type { BasePropertySchema } from '~core/database'
  import ImageCarousel from './image-carousel.svelte'
  import api from '~api'
  import GallerySidebar from './gallery-sidebar.svelte'

  let {
    onClose,
    open,
    property,
  }: {
    open: boolean
    property: BasePropertySchema
    onClose: () => void
  } = $props()

  let loadingStates = $state<{ [key: string]: boolean }>({})
  let activeImageIndex = $state<number | null>(null)
  let showDetailOnMobile = $state(false)

  function close() {
    activeImageIndex = null
    showDetailOnMobile = false
    onClose()
  }

  const onApply = async () => {
    loadingStates['apply'] = true
    await api.properties.autoApply.post()
    loadingStates['apply'] = false
    close()
  }

  const onNotInterested = async () => {
    loadingStates['notInterested'] = true
    await api.properties.markAsNotInterested.post()
    loadingStates['notInterested'] = false
    close()
  }
</script>

{#if open}
  <div class=".fixed .inset-0 .z-50 .flex .flex-col .bg-white">
    <div
      class=".flex .items-center .justify-between .border-b .px-4 .py-2 sm:.items-end sm:.justify-end sm:.gap-3 sm:.px-2"
    >
      <h2 class=".text-lg .font-semibold .text-gray-900 sm:.hidden">
        {property.title || 'Gallery'}
      </h2>
      <div class=".flex .items-center .gap-2">
        <Button
          subtle
          onClick={() => window.open(property.sourceURL, '_blank')}
          className=".flex"
        >
          <ExternalLinkSVG slot="icon" />
          <span class=".inline sm:.hidden">View on source</span>
        </Button>

        <Button
          subtle
          onClick={onNotInterested}
          loading={loadingStates['notInterested']}
        >
          <ThumbDownSVG slot="icon" />
          Not interested
        </Button>

        <Button primary onClick={onApply} loading={loadingStates['apply']}>
          <RocketSVG slot="icon" />
          Apply
        </Button>

        <div class=".mx-2 .h-6 .w-px .bg-gray-200"></div>

        <button
          class=".rounded-full .p-2 hover:.bg-gray-100"
          onclick={close}
          aria-label="Close gallery"
        >
          <XSVG class=".h-6 .w-6 .text-gray-500" />
        </button>
      </div>
    </div>

    <div class=".flex .flex-1 .overflow-hidden">
      {#if showDetailOnMobile}
        <GallerySidebar {property} class=".flex-1" />
      {:else}
        <div class=".flex-1 .overflow-y-auto .p-4">
          {#if activeImageIndex !== null}
            <ImageCarousel
              images={property.imageURLs.map(url => ({
                src: url,
                sourceName: property.sourceName,
              }))}
              activeIndex={activeImageIndex}
              onBack={() => (activeImageIndex = null)}
            />
          {:else}
            <div
              class=".grid .grid-cols-4 .gap-2 lg:.grid-cols-4 md:.grid-cols-3 sm:.grid-cols-2"
            >
              {#each property.imageURLs as url, i}
                <button
                  type="button"
                  class=".relative .aspect-[4/3] .cursor-pointer .overflow-hidden .rounded-sm .bg-gray-100"
                  onclick={() => (activeImageIndex = i)}
                  aria-label={`Open image ${i + 1} of ${property.title}`}
                >
                  <img
                    src={url}
                    alt={`${property.title} ${i + 1}`}
                    class=".h-full .w-full .object-cover .transition-transform hover:.scale-105"
                    loading="lazy"
                  />
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <GallerySidebar {property} class="sm:.hidden" />
      {/if}
    </div>

    <button
      class=".fixed .bottom-6 .right-6 .z-40 .hidden .h-14 .w-14 .items-center .justify-center .rounded-full .bg-primary .text-white .shadow-lg .transition-all hover:.scale-110 hover:.bg-primary/90 active:.scale-95 sm:.flex"
      onclick={() => (showDetailOnMobile = !showDetailOnMobile)}
      aria-label="Toggle details"
    >
      {#if showDetailOnMobile}
        <XSVG class=".h-6 .w-6" />
      {:else}
        <span class=".text-2xl .font-bold">ℹ</span>
      {/if}
    </button>

    {#if !activeImageIndex}
      <span
        class=".absolute .bottom-2 .right-2 .rounded .bg-black/50 .px-2 .py-0.5 .text-xs .font-medium .text-white .backdrop-blur-sm"
      >
        Images are taken from {property.sourceName || 'various sources'}
      </span>
    {/if}
  </div>
{/if}
