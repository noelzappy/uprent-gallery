<script lang="ts">
  import { ChevronLeftSVG, ChevronRightSVG, XSVG } from '~ui/assets'

  let {
    images,
    activeIndex,
    onBack,
  }: {
    images: string[]
    activeIndex: number
    onBack: () => void
  } = $props()

  let currentIndex = $state(activeIndex)

  function next() {
    currentIndex = (currentIndex + 1) % images.length
  }

  function prev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length
  }

  function goTo(index: number) {
    currentIndex = index
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') next()
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'Escape') onBack()
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class=".relative .flex .h-full .w-full .flex-col .bg-black">
  <div
    class=".absolute .left-0 .top-0 .z-20 .flex .w-full .items-center .justify-between .p-4"
  >
    <button
      class=".rounded-full .bg-black/50 .p-2 .text-white .backdrop-blur-sm .transition-colors hover:.bg-black/70"
      onclick={onBack}
      aria-label="Close carousel"
    >
      <XSVG class=".h-6 .w-6" />
    </button>

    <div
      class=".rounded-full .bg-black/50 .px-3 .py-1 .text-sm .font-medium .text-white .backdrop-blur-sm"
    >
      {currentIndex + 1} / {images.length}
    </div>
  </div>

  <div
    class=".relative .flex .flex-1 .items-center .justify-center .overflow-hidden"
  >
    <button
      class=".absolute .left-4 .z-10 .rounded-full .bg-black/50 .p-2 .text-white .backdrop-blur-sm .transition-colors hover:.bg-black/70 md:.p-3"
      onclick={prev}
      aria-label="Previous image"
    >
      <ChevronLeftSVG class=".h-6 .w-6 md:.h-8 md:.w-8" />
    </button>

    <img
      src={images[currentIndex]}
      alt="Property view {currentIndex + 1}"
      class=".max-h-full .max-w-full .object-contain"
    />

    <button
      class=".absolute .right-4 .z-10 .rounded-full .bg-black/50 .p-2 .text-white .backdrop-blur-sm .transition-colors hover:.bg-black/70 md:.p-3"
      onclick={next}
      aria-label="Next image"
    >
      <ChevronRightSVG class=".h-6 .w-6 md:.h-8 md:.w-8" />
    </button>
  </div>

  <div class=".h-24 .w-full .bg-black/90 .p-4">
    <div class=".flex .h-full .gap-2 .overflow-x-auto .no-scrollbar">
      {#each images as image, i}
        <button
          class=".relative .aspect-[4/3] .h-full .flex-shrink-0 .overflow-hidden .rounded-sm .transition-all {i ===
          currentIndex
            ? '.ring-2 .ring-white .ring-offset-2 .ring-offset-black'
            : '.opacity-50 hover:.opacity-100'}"
          onclick={() => goTo(i)}
          aria-label="View image {i + 1}"
        >
          <img
            src={image}
            alt="Thumbnail {i + 1}"
            class=".h-full .w-full .object-cover"
          />
        </button>
      {/each}
    </div>
  </div>
</div>
