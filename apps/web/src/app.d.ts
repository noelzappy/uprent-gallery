// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { ISupportedLocale } from '~i18n'

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      locale: ISupportedLocale
    }
    // interface PageData {}
    // interface Platform {}
  }
}

export {}
