import { Elysia } from 'elysia'
import { emailsRoute, propertiesRoute } from './routes'
import { initDatabase } from './database/setup-db'
import { initSyncAll } from './workers/emails.worker'
import db from './database/db'

initDatabase(db)

const app = new Elysia()
  .use(emailsRoute)
  .use(propertiesRoute)

  .listen({ hostname: '::', port: 5002 }, async server => {
    console.debug(`Server is running at ${server.hostname}:${server.port}`)

    try {
      initSyncAll()
    } catch (error) {
      //
    }
    // setInterval(
    //   async () => {
    //     try {
    //       await initSyncAll()
    //     } catch (error) {
    //       //
    //     }
    //   },
    //   15 * 60 * 1000,
    // )
  })
  .decorate('db', db)

export type App = typeof app
