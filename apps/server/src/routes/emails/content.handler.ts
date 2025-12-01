import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'
import { EMAIL_CATEGORY } from '~core/database'
import { emailServer } from '~integrations/email-server'

const resDTO = t.Object({
  email: t.Object({
    uid: t.Number(),
    seen: t.Boolean(),
    categories: t.Optional(t.Array(t.Enum(EMAIL_CATEGORY))),
    messageId: t.String(),
    datetime: t.String({ format: 'date-time' }),
    subject: t.String(),
    content: t.String(),
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
    attachments: t.Array(
      t.Object({
        uid: t.Number(),
        contentType: t.String(),
        filename: t.Optional(t.String()),
        size: t.Number(),
        contentId: t.Optional(t.String()),
        related: t.Optional(t.Boolean()),
      }),
    ),
  }),
})

const reqParamsDTO = t.Object({
  uid: t.Number(),
})

export const fetchEmailContentHandler = new Elysia().use(corePlugin).get(
  '/emails/content/:uid',
  async ({ res, params }) => {
    const { uid } = params

    const email = await emailServer.fetchSingleEmail(
      Bun.env.EMAIL_USERNAME!,
      Bun.env.EMAIL_PASSWORD!,
      uid,
    )
    return res.ok({
      email,
    })
  },
  { response: res(resDTO), params: reqParamsDTO },
)
