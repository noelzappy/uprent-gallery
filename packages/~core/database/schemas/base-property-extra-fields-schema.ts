import type { ENERGY_LABEL, INTERIOR, StringBoolean } from '../data-types'

export type BasePropertyExtraFieldsSchema = Partial<{
  netPrice: number | null
  anno: number | null
  floor: number | null
  floorsAmount: number | null
  rooms: number | null
  ageMax: number | null
  ageMin: number | null
  isRoom: StringBoolean | null
  unitSuffix?: number | null
  propertyType: 'room' | 'studio' | 'apartment-or-house' | null
  electricCarChargerAvailable: StringBoolean | null
  airConditioning: StringBoolean | null
  deposit: number | null
  bedrooms: number | null
  elevator: StringBoolean | null
  interior: INTERIOR | null
  bathrooms: number | null
  shortTerm: StringBoolean | null
  reactUntil: string | null
  energyLabel: ENERGY_LABEL | null
  kidsAllowed: StringBoolean | null
  petsAllowed: StringBoolean | null
  petsKind: string[] | null
  solarPanels: StringBoolean | null
  rentSubsidyAvailable: StringBoolean | null
  maxReduction: number | null
  offeredSince: string | null
  serviceCosts: 'no' | number | null
  availableSince: string | 'now' | null
  availableUntil: string | null
  forSeniorsOnly: StringBoolean | null
  isCareHousing: StringBoolean | null
  sharingAllowed: StringBoolean | null
  sharedFlatmatesAmount: number | null
  sexOfOccupants: 'male' | 'female' | 'mixed' | null
  outdoorSpace: StringBoolean | null
  totalParcelArea: number | null
  sharedKitchen: StringBoolean | null
  sharedBathroom: StringBoolean | null
  sharedToilet: StringBoolean | null
  forStudentsOnly: StringBoolean | null
  /*
   * If male cannot rent property, set to "male"
   * If female cannot rent property, set to "female"
   * If explicitly mentioned every gender is welcome, set to "no"
   * If preference to gender but not strict exclusion, set to "no"
   */
  genderExclusion: 'male' | 'female' | 'no' | null
  studentsAllowed: StringBoolean | null
  maxHouseholdSize: number | null
  tvChargeIncluded: StringBoolean | null
  agreementDuration:
    | 'Model A'
    | 'Model B'
    | 'Model C'
    | 'Vacancy Act'
    | 'Antisquatting'
    | 'Campus contract'
    | 'Youth contract'
    | 'No contract'
    | null
  /*
   * Specifies language that tenant must speak
   */
  languageExclusion: 'no' | string | null
  utilitiesIncluded: StringBoolean | 'some' | null
  registrationAllowed: StringBoolean | null
  waterChargeIncluded: StringBoolean | null
  energyChargeIncluded: StringBoolean | null
  internetChargeIncluded: StringBoolean | null
  utilityCostsElectricityAndGas: number | null
  utilityCostsElectricity: number | null
  utilityCostsGas: number | null
  utilityCostsWater: number | null
  utilityCostsInternet: number | null
  utilityCostsTv: number | null
  utilityCostsPhone: number | null
  tenantSelectionProcess:
    | 'Lottery'
    | 'Waitlist'
    | 'First come, first serve'
    | 'Selection by current tenants'
    | 'Landlord decides'
    | null
  locationShortDescription: string | null
  propertyShortDescription: string | null
  housingPermitRequiredHague: StringBoolean | null
  viewingPossible: StringBoolean | null
  guarantorsAllowed: StringBoolean | null
  entrepreneursAllowed: StringBoolean | null
  maxIncomeRequirementDoubleAnnual: number | null
  maxIncomeRequirementSingleAnnual: number | null
  minIncomeRequirementDoubleMonthly: number | null
  minIncomeRequirementSingleMonthly: number | null
  minIncomeRequirementDoubleAnnual: number | null
  minIncomeRequirementSingleAnnual: number | null
  minRpTerm: number | null
  wwsPoints: number | null
}>
