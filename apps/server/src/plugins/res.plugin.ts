import { Elysia } from 'elysia'

export const resPlugin = new Elysia({ name: 'res.plugin' }).resolve(
  { as: 'global' },
  ({ set }) => {
    const success = <TPayload>(payload: TPayload) => ({
      status: 'success' as const,
      payload,
    })
    const res = {
      ok: <TPayload>(payload: TPayload) => {
        set.status = 200
        return success(payload)
      },
      badRequest: <TMessage>(message: TMessage) => {
        set.status = 400
        return { message }
      },
      unauthorized: <TMessage>(message: TMessage) => {
        set.status = 401
        return { message }
      },
      forbidden: <TMessage>(message: TMessage) => {
        set.status = 403
        return { message }
      },
      notFound: <TMessage>(message: TMessage) => {
        set.status = 404
        return { message }
      },
      serverError: <TMessage>(message: TMessage) => {
        set.status = 500
        return { message }
      },
    }

    return {
      res,
    }
  },
)
