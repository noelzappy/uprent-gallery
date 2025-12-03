import { Elysia } from 'elysia'
import { resPlugin } from './res.plugin'
import { errorPlugin } from './error.plugin'
import cors from '@elysiajs/cors'

export const corePlugin = new Elysia({
  name: 'core.plugin',
  serve: {
    maxRequestBodySize: 1024 * 1024 * 500,
    idleTimeout: 255,
  },
})
  // add artificial "load" time to every request
  .onBeforeHandle(
    { as: 'global' },
    async () => await new Promise(r => setTimeout(r, 500)),
  )
  .use(
    cors({
      origin: () => true,
    }),
  )
  .use(resPlugin)
  .use(errorPlugin)
