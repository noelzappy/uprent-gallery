import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'

export const autoApplyToPropertyHandler = new Elysia().use(corePlugin).post(
  '/properties/autoApply',
  async ({ res }) => {
    return res.ok(null)
  },
  {
    response: res(t.Null()),
  },
)
