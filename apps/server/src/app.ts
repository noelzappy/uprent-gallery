import { Elysia } from 'elysia'
import { emailsRoute, propertiesRoute } from './routes'
import { initDatabase, seedDatabase } from './database/setup-db'
import { initSyncAll } from './workers/emails.worker'
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

    try {
      await initSyncAll()
    } catch (error) {
      console.error('[App] Initial email sync failed:', error)
    }

    // Sync emails every 10 minutes
    setInterval(
      async () => {
        try {
          await initSyncAll()
        } catch (error) {
          console.error('[App] Email sync failed:', error)
        }
      },
      10 * 60 * 1000,
    )
  })
  .decorate('db', db)

export type App = typeof app
