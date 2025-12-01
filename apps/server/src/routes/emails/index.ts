import { Elysia } from 'elysia'
import { loadEmailsHandler } from './load.handler'
import { fetchEmailContentHandler } from './content.handler'

export const emailsRoute = new Elysia()
  .use(loadEmailsHandler)
  .use(fetchEmailContentHandler)
