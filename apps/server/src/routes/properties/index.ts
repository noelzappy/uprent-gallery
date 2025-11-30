import { Elysia } from 'elysia'
import { cleanPropertyImageHandler } from './clean-image.handler'
import { autoApplyToPropertyHandler } from './auto-apply.handler'
import { markPropertyAsNotInterestedHandler } from './mark-as-not-interested.handler'

export const propertiesRoute = new Elysia()
  .use(cleanPropertyImageHandler)
  .use(autoApplyToPropertyHandler)
  .use(markPropertyAsNotInterestedHandler)
