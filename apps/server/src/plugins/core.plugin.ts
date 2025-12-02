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
  .use(
    cors({
      origin: () => true,
    }),
  )
  .use(resPlugin)
  .use(errorPlugin)
