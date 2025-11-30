import { type TSchema, t } from 'elysia'

export const res = <TPayload extends TSchema>(payloadSchema: TPayload) => {
  const success = t.Object({
    status: t.Literal('success'),
    payload: payloadSchema,
  })

  const error = t.Object({ message: t.String() })

  return {
    200: success,
    400: error,
    401: error,
    403: error,
    404: error,
    500: error,
  }
}

export { corePlugin } from './core.plugin'
