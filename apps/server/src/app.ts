import { Elysia } from 'elysia'
import { emailsRoute, propertiesRoute } from './routes'
import { initDatabase, seedDatabase } from './database/setup-db'
import db from './database/db'
import { corePlugin } from './plugins'
import { statePlugin, worker } from './plugins/state.plugin'

await initDatabase(db)
await seedDatabase(db)

const app = new Elysia()
  .use(corePlugin)
  .use(statePlugin)
  .use(emailsRoute)
  .use(propertiesRoute)
  .listen({ hostname: '::', port: 5002 }, async server => {
    console.debug(`Server is running at ${server.hostname}:${server.port}`)
    worker.postMessage('sync')
    setInterval(
      () => {
        worker.postMessage('sync')
      },
      5 * 60 * 1000,
    )
  })

export type App = typeof app
