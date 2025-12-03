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

  function close() {
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
    <div class=".flex .items-center .justify-between .border-b .px-4 .py-3">
      <h2 class=".text-lg .font-semibold .text-gray-900">
        {property.title || 'Gallery'}
      </h2>
      <div class=".flex .items-center .gap-2">
        <Button
          subtle
          onClick={() => window.open(property.sourceURL, '_blank')}
          className=".hidden sm:.flex"
        >
          <ExternalLinkSVG slot="icon" />
          Open
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
            class=".grid .grid-cols-4 .gap-2 md:.grid-cols-2 sm:.grid-cols-1"
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

      <div class=".w-96 .overflow-y-auto .border-l .p-6">
        <div class=".space-y-8">
          <div class=".space-y-4">
            <div class=".flex .items-center .gap-2">
              <span class=".font-semibold .text-gray-900">{property.title}</span
              >
            </div>
            <div>
              <h3 class=".text-2xl .font-bold .text-gray-900">
                € {property.price}
                <span class=".text-base .font-normal .text-gray-500"
                  >/ month</span
                >
              </h3>
              <p class=".text-gray-500">{property.cityName}</p>
            </div>
          </div>

          <div
            class=".grid .grid-cols-2 .gap-4 .border-y .border-gray-100 .py-6"
          >
            <div class=".flex .items-center .gap-3">
              <div class=".rounded-lg .bg-gray-100 .p-2 .text-primary">
                <BedSVG class=".h-5 .w-5" />
              </div>
              <div>
                <p class=".text-xs .text-gray-500">Bedrooms</p>
                <p class=".font-semibold .text-gray-900">
                  {property?.extraFields?.bedrooms ||
                    property.extraFields?.rooms}
                </p>
              </div>
            </div>
            <div class=".flex .items-center .gap-3">
              <div class=".rounded-lg .bg-gray-100 .p-2 .text-primary">
                <BathSVG class=".h-5 .w-5" />
              </div>
              <div>
                <p class=".text-xs .text-gray-500">Bathrooms</p>
                <p class=".font-semibold .text-gray-900">
                  {property.extraFields?.bathrooms || 1}
                </p>
              </div>
            </div>
            <div class=".flex .items-center .gap-3">
              <div class=".rounded-lg .bg-gray-100 .p-2 .text-primary">
                <DimensionsSVG class=".h-5 .w-5" />
              </div>
              <div>
                <p class=".text-xs .text-gray-500">Area</p>
                <p class=".font-semibold .text-gray-900">{property.area} m²</p>
              </div>
            </div>
            <div class=".flex .items-center .gap-3">
              <div class=".rounded-lg .bg-gray-100 .p-2 .text-primary">
                <ArmchairSVG class=".h-5 .w-5" />
              </div>
              <div>
                <p class=".text-xs .text-gray-500">Interior</p>
                <p class=".font-semibold .capitalize .text-gray-900">
                  {property.extraFields?.interior}
                </p>
              </div>
            </div>
          </div>

          {#if property.extraFields?.propertyShortDescription}
            <div>
              <h4 class=".mb-2 .font-semibold .text-gray-900">
                About this home
              </h4>
              <p class=".text-sm .leading-relaxed .text-gray-600">
                {property.extraFields.propertyShortDescription}
              </p>
            </div>
          {/if}

          <div>
            <h4 class=".mb-2 .font-semibold .text-gray-900">
              Financial Details
            </h4>
            <p class=".text-sm .leading-relaxed .text-gray-600">
              {property.extraFields?.minIncomeRequirementDoubleAnnual
                ? `Minimum Income Requirement: € ${property.extraFields.minIncomeRequirementDoubleAnnual / 2} per month (€ ${property.extraFields.minIncomeRequirementDoubleAnnual} annually).`
                : 'No minimum income requirement specified.'}
            </p>
          </div>

          <div class=".space-y-3">
            <h4 class=".font-semibold .text-gray-900">Details</h4>

            <div class=".flex .items-center .justify-between .text-sm">
              <div class=".flex .items-center .gap-2 .text-gray-600">
                <CalendarEventSVG class=".h-4 .w-4" />
                <span>Available</span>
              </div>
              <span class=".font-medium .text-gray-900"
                >{property.extraFields?.availableSince}</span
              >
            </div>

            {#if property.extraFields?.deposit}
              <div class=".flex .items-center .justify-between .text-sm">
                <div class=".flex .items-center .gap-2 .text-gray-600">
                  <CoinEuroSVG class=".h-4 .w-4" />
                  <span>Deposit</span>
                </div>
                <span class=".font-medium .text-gray-900"
                  >€ {property.extraFields.deposit}</span
                >
              </div>
            {/if}

            {#if property.extraFields?.energyLabel}
              <div class=".flex .items-center .justify-between .text-sm">
                <div class=".flex .items-center .gap-2 .text-gray-600">
                  <BoltSVG class=".h-4 .w-4" />
                  <span>Energy Label</span>
                </div>
                <span
                  class=".rounded .bg-green-100 .px-2 .py-0.5 .font-medium .text-green-700"
                  >{property.extraFields?.energyLabel?.toUpperCase()}</span
                >
              </div>
            {/if}

            {#if property.extraFields?.petsAllowed}
              <div class=".flex .items-center .justify-between .text-sm">
                <div class=".flex .items-center .gap-2 .text-gray-600">
                  <PawSVG class=".h-4 .w-4" />
                  <span>Pets</span>
                </div>
                <span class=".font-medium .capitalize .text-gray-900"
                  >{property.extraFields?.petsAllowed}</span
                >
              </div>
            {/if}
          </div>

          <span
            class=".absolute .bottom-2 .right-2 .rounded .bg-black/50 .px-2 .py-0.5 .text-xs .font-medium .text-white .backdrop-blur-sm"
          >
            Images are taken from {property.sourceName || 'various sources'}
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}
