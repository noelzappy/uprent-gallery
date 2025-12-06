import { Elysia } from 'elysia'
import db from '../database/db'

export const worker = new Worker(
  new URL('../workers/emails.worker.ts', import.meta.url).href,
)

export const statePlugin = new Elysia({ name: 'state' })
  .decorate('db', db)
  .decorate('emailWorker', worker)
