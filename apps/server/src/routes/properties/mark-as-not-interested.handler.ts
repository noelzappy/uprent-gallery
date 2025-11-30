import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'

export const markPropertyAsNotInterestedHandler = new Elysia()
  .use(corePlugin)
  .post(
    '/properties/markAsNotInterested',
    async ({ res }) => {
      return res.ok(null)
    },
    {
      response: res(t.Null()),
    },
  )
