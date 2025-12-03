import { Elysia } from 'elysia'
import { emailsRoute, propertiesRoute } from './routes'
import { initDatabase, seedDatabase } from './database/setup-db'
import db from './database/db'
import { corePlugin } from './plugins'

initDatabase(db)
await seedDatabase(db)

const app = new Elysia()
  .use(emailsRoute)
  .use(propertiesRoute)
  .use(corePlugin)
  .listen({ hostname: '::', port: 5002 }, async server => {
    console.debug(`Server is running at ${server.hostname}:${server.port}`)

    const worker = new Worker(
      new URL('./workers/emails.worker.ts', import.meta.url).href,
    )

    worker.postMessage('sync')

    // Sync emails every 10 minutes
    setInterval(
      () => {
        worker.postMessage('sync')
      },
      10 * 60 * 1000,
    )
  })
  .decorate('db', db)

export type App = typeof app
