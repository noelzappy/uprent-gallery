import { t, Elysia } from 'elysia'
import { corePlugin } from '@/plugins'

const paramsDTO = t.Object({
  id: t.Numeric(),
})

export const emailActionsHandler = new Elysia()
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
    async context => {
      const {
        params: { id },
        emailWorker,
      } = context as any
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
    async context => {
      const {
        params: { id },
        emailWorker,
      } = context as any
      emailWorker.postMessage({ type: 'deleteEmail', payload: { emailId: id } })
      return { success: true }
    },
    { params: paramsDTO },
  )
