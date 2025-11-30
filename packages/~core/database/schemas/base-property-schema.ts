import type { PROPERTY_SOURCE, Tour360 } from '../data-types'
import type { BasePropertyExtraFieldsSchema } from './base-property-extra-fields-schema'

export type PropertySource = PROPERTY_SOURCE | string

export interface BasePropertySchema {
  isRemoved?: boolean
  addedTime: string
  landlordName?: string
  landlordAvatarImage?: string
  landlordType?: 'private-landlord' | 'other'
  propertyPlatformId: string
  fundaNewPlatformId?: string
  sourceName: PropertySource
  platformName?: string
  sourcePriority: 0 | 1 // 0 = uprent.nl, 1 = other. This helps us prioritize uprent.nl listings in the feed.
  lastRevalidatedTime: string
  revalidationAttempts?: number
  nextRevalidationTime?: string
  submittedByUsers?: boolean
  sourceURL: string
  title: string
  cityName: string
  excludeFromPublicView?: boolean // When true, indicates that title and cityName are the same (usually when we couldn't scrape the property's address)
  price?: number
  area?: number
  previewImageURL: string
  tour360?: Tour360
  latitude?: number
  longitude?: number
  imageURLs: string[]
  applicationPageURL?: string
  district?: string
  houseNumber?: number
  houseNumberAddition?: string
  houseLetter?: string
  postalCode?: string
  street?: string
  reviewCount?: number
  sppParsed?: boolean
  bedroomsEstimated?: boolean
  hidePrice?: boolean // When true, indicates the landlord does not want the price shown on public pages
  landlordNote?: string
  extraFields?: BasePropertyExtraFieldsSchema
}
