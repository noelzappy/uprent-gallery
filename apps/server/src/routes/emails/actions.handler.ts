import { t, Elysia } from 'elysia'
import { corePlugin } from '@/plugins'
import { statePlugin } from '@/state'

const paramsDTO = t.Object({
  id: t.Numeric(),
})

export const emailActionsHandler = new Elysia()
  .use(statePlugin)
  .use(corePlugin)
  .post(
    '/emails/actions/:id/seen',
    async ({ params, emailWorker }) => {
      const { id } = params
      emailWorker.postMessage({
        type: 'markAsSeen',
        payload: { emailUid: id },
      })
      return { success: true }
    },
    { params: paramsDTO },
  )
  .delete(
    '/emails/actions/:id/seen',
    async ({ params, emailWorker }) => {
      const { id } = params
      emailWorker.postMessage({
        type: 'markAsUnseen',
        payload: { emailUid: id },
      })
      return { success: true }
    },
    { params: paramsDTO },
  )
  .delete(
    '/emails/actions/:id',
    async ({ params, emailWorker }) => {
      const { id } = params
      emailWorker.postMessage({
        type: 'deleteEmail',
        payload: { emailUid: id },
      })
      return { success: true }
    },
    { params: paramsDTO },
  )
