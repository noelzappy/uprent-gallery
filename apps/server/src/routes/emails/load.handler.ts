import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'
import { EMAIL_CATEGORY } from '~core/database'
import { emailServer } from '~integrations/email-server'

const emailHeadersResDTO = t.Object({
  emailHeaders: t.Array(
    t.Object({
      uid: t.Number(),
      seen: t.Boolean(),
      categories: t.Optional(t.Array(t.Enum(EMAIL_CATEGORY))),
      messageId: t.String(),
      datetime: t.String({ format: 'date-time' }),
      subject: t.String(),
      from: t.Object({
        name: t.Optional(t.String()),
        email: t.String({ format: 'email' }),
      }),
      to: t.Array(
        t.Object({
          name: t.Optional(t.String()),
          email: t.String({ format: 'email' }),
        }),
      ),
      cc: t.Optional(t.Array(t.String())),
      inReplyTo: t.Optional(t.String()),
      references: t.Optional(t.Array(t.String())),
      flags: t.Array(t.String()),
    }),
  ),
  paging: t.Object({
    cursor: t.Number(),
    hasMore: t.Boolean(),
  }),
})

const emailReqQueryDTO = t.Object({
  cursor: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
})

export const loadEmailsHandler = new Elysia().use(corePlugin).get(
  '/emails/load',
  async ({ res, query }) => {
    const { cursor, limit } = query

    const { emails, paging } = await emailServer.loadEmailHeaders({
      username: Bun.env.EMAIL_USERNAME!,
      password: Bun.env.EMAIL_PASSWORD!,
      cursor,
      limit,
    })

    console.log(`Returning ${emails.length} email headers`)
    return res.ok({
      emailHeaders: emails,
      paging,
    })
  },
  { response: res(emailHeadersResDTO), query: emailReqQueryDTO },
)
