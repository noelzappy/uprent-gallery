import { Elysia } from 'elysia'
import { loadEmailsHandler } from './load.handler'

export const emailsRoute = new Elysia().use(loadEmailsHandler)
