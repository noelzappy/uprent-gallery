import { Elysia } from 'elysia'
import { emailsRoute, propertiesRoute } from './routes'
import { corePlugin } from './plugins'

const app = new Elysia()
  .use(corePlugin)
  .use(emailsRoute)
  .use(propertiesRoute)
  .listen({ hostname: '::', port: 5002 }, server => {
    console.debug(`Server is running at ${server.hostname}:${server.port}`)
  })

export type App = typeof app
