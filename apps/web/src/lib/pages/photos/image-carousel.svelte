<script lang="ts">
  import api from '~api'
  import {
    ChevronLeftSVG,
    ChevronRightSVG,
    XSVG,
    WandSVG,
    EyeSVG,
    LoadingSpinnerSVG,
  } from '~ui/assets'

  let {
    images,
    activeIndex,
    onBack,
  }: {
    images: {
      src: string
      sourceName?: string
    }[]
    activeIndex: number
    onBack: () => void
  } = $props()

  let currentIndex = $state(activeIndex)
  let cleanedImages = $state<Record<number, string>>({})
  let isCleaning = $state(false)
  let showOriginal = $state(false)

  function next() {
    currentIndex = (currentIndex + 1) % images.length
  }

  function prev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length
  }

  function goTo(index: number) {
    currentIndex = index
  }

  const onAICleanImages = async (image: File) => {
    const { data } = await api.properties.cleanImage.post({ image })
    if (data && data.cleanedImage) {
      return URL.createObjectURL(data.cleanedImage)
    }
    return null
  }

  async function handleClean() {
    if (isCleaning) return
    isCleaning = true
    try {
      const response = await fetch(images[currentIndex].src)
      const blob = await response.blob()
      const file = new File([blob], 'image.jpg', { type: blob.type })
      const result = await onAICleanImages(file)
      if (result) {
        cleanedImages[currentIndex] = result
      }
    } finally {
      isCleaning = false
    }
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
    <div class=".absolute .right-24 .top-4 .z-30">
      {#if cleanedImages[currentIndex]}
        <button
          class=".group .flex .items-center .gap-2 .rounded-full .px-4 .py-2 .text-sm .font-medium .text-white .shadow-lg .transition-all hover:.bg-primary active:.scale-95"
          onmousedown={() => (showOriginal = true)}
          onmouseup={() => (showOriginal = false)}
          onmouseleave={() => (showOriginal = false)}
          ontouchstart={() => (showOriginal = true)}
          ontouchend={() => (showOriginal = false)}
        >
          <EyeSVG class=".h-4 .w-4" />
          <span>Hold to Compare</span>
        </button>
      {:else}
        <button
          class=".flex .items-center .gap-2 .rounded-full .bg-white/30 .px-4 .py-2 .text-sm .font-medium .text-white .backdrop-blur-md .transition-all hover:.bg-white/20 active:.scale-95 disabled:.cursor-not-allowed disabled:.opacity-50"
          onclick={handleClean}
          disabled={isCleaning}
        >
          {#if isCleaning}
            <LoadingSpinnerSVG class=".h-4 .w-4 .animate-spin" />
            <span>Cleaning...</span>
          {:else}
            <WandSVG class=".h-4 .w-4" />
            <span>Magic Clean</span>
          {/if}
        </button>
      {/if}
    </div>

    <button
      class=".absolute .left-4 .z-10 .rounded-full .bg-black/50 .p-2 .text-white .backdrop-blur-sm .transition-colors hover:.bg-black/70 md:.p-3"
      onclick={prev}
      aria-label="Previous image"
    >
      <ChevronLeftSVG class=".h-6 .w-6 md:.h-8 md:.w-8" />
    </button>

    <div class=".relative .max-h-full .max-w-full">
      <img
        src={showOriginal
          ? images[currentIndex].src
          : cleanedImages[currentIndex] || images[currentIndex].src}
        alt="Property view {currentIndex + 1}"
        class=".max-h-full .max-w-full .object-contain"
      />
      {#if cleanedImages[currentIndex] && !showOriginal}
        <div
          class=".absolute .bottom-4 .left-1/2 .flex .-translate-x-1/2 .items-center .gap-1.5 .rounded-full .bg-primary/90 .px-3 .py-1 .text-xs .font-medium .text-white .shadow-sm .backdrop-blur-sm"
        >
          <WandSVG class=".h-3 .w-3" />
          <span>Cleaned with AI</span>
        </div>
      {/if}
    </div>

    <span
      class=".absolute .bottom-2 .right-2 .rounded .bg-black/50 .px-2 .py-0.5 .text-xs .font-medium .text-white .backdrop-blur-sm"
    >
      Images are taken from {images[currentIndex].sourceName ||
        'various sources'}
    </span>

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
            src={image.src}
            alt="Thumbnail {i + 1}"
            class=".h-full .w-full .object-cover"
          />
        </button>
      {/each}
    </div>
  </div>
</div>
