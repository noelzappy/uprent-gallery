<script lang="ts">
  import {
    BedSVG,
    BathSVG,
    DimensionsSVG,
    ArmchairSVG,
    CalendarEventSVG,
    CoinEuroSVG,
    PawSVG,
    BoltSVG,
  } from '~ui/assets'
  import type { BasePropertySchema } from '~core/database'

  let {
    property,
    class: className,
  }: {
    property: BasePropertySchema
    class?: string
  } = $props()
</script>

<div class=".w-96 .overflow-y-auto .border-l .p-6 md:.w-80 {className}">
  <div class=".space-y-8">
    <div class=".space-y-4">
      <div class=".flex .items-center .gap-2">
        <span class=".font-semibold .text-gray-900">{property.title}</span>
      </div>
      <div>
        <h3 class=".text-2xl .font-bold .text-gray-900">
          € {property.price}
          <span class=".text-base .font-normal .text-gray-500">/ month</span>
        </h3>
        <p class=".text-gray-500">{property.cityName}</p>
      </div>
    </div>

    <div class=".grid .grid-cols-2 .gap-4 .border-y .border-gray-100 .py-6">
      <div class=".flex .items-center .gap-3">
        <div class=".rounded-lg .bg-gray-100 .p-2 .text-primary">
          <BedSVG class=".h-5 .w-5" />
        </div>
        <div>
          <p class=".text-xs .text-gray-500">Bedrooms</p>
          <p class=".font-semibold .text-gray-900">
            {property?.extraFields?.bedrooms || property.extraFields?.rooms}
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
        <h4 class=".mb-2 .font-semibold .text-gray-900">About this home</h4>
        <p class=".text-sm .leading-relaxed .text-gray-600">
          {property.extraFields.propertyShortDescription}
        </p>
      </div>
    {/if}

    <div>
      <h4 class=".mb-2 .font-semibold .text-gray-900">Financial Details</h4>
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
  </div>
</div>
