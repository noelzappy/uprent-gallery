import { Elysia } from 'elysia'
import { emailsRoute, propertiesRoute } from './routes'
import { corePlugin } from './plugins'

const emailsWorker = new Worker('./src/workers/emails.worker.ts')
const app = new Elysia()
  .use(emailsRoute)
  .use(propertiesRoute)
  .listen({ hostname: '::', port: 5002 }, server => {
    console.debug(`Server is running at ${server.hostname}:${server.port}`)
    emailsWorker.postMessage('start-sync')
  })

export type App = typeof app
