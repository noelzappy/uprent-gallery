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
    '/emails/:id/seen',
    async ({ params, emailWorker }) => {
      const { id } = params
      emailWorker.postMessage({ type: 'markAsSeen', payload: { emailId: id } })
      return { success: true }
    },
    { params: paramsDTO },
  )
  .delete(
    '/emails/:id/seen',
    async ({ params, emailWorker }) => {
      const { id } = params
      emailWorker.postMessage({
        type: 'markAsUnseen',
        payload: { emailId: id },
      })
      return { success: true }
    },
    { params: paramsDTO },
  )
  .delete(
    '/emails/:id',
    async ({ params, emailWorker }) => {
      const { id } = params
      emailWorker.postMessage({ type: 'deleteEmail', payload: { emailId: id } })
      return { success: true }
    },
    { params: paramsDTO },
  )
