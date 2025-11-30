import { Elysia } from 'elysia'
import type { Static } from '@sinclair/typebox'
import { res } from '.'

export const errorPlugin = new Elysia({ name: 'error.plugin' }).onError(
  { as: 'global' },
  details => {
    const { code, error, path, body } = details

    if (code === 'NOT_FOUND') {
      return error
    }

    if (code !== 'VALIDATION') {
      console.error(
        'Encountered server error',
        JSON.stringify(
          {
            errorPath: path,
            errorType: `\`${code}\` error`,
            errorDetails:
              'stack' in error && error.stack
                ? error.stack
                : JSON.stringify(error),
            requestBody: JSON.stringify(body),
          },
          null,
          2,
        ),
      )
    }

    if (code === 'UNKNOWN') {
      return {
        status: 'error',
        message: error.message,
      }
    }

    validation: if (code === 'VALIDATION') {
      const responseBody = error.value as Static<ReturnType<typeof res>>
      if (responseBody?.status === 'error') break validation

      for (const err of error.all) {
        if (!err || !('type' in err)) continue

        const { path, value, message, summary } = err

        console.error(
          'DTO error details',
          JSON.stringify(
            {
              path,
              value,
              message,
              summary,
            },
            null,
            2,
          ),
        )
      }

      return responseBody
    }
  },
)
