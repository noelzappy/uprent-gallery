import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'
import { EMAIL_CATEGORY } from '~core/database'
import { emailServer } from '~integrations/email-server'

const resDTO = t.Object({
  emails: t.Array(
    t.Object({
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
  ),
})

export const loadEmailsHandler = new Elysia().use(corePlugin).get(
  '/emails/load',
  async ({ res }) => {
    const emails = await emailServer.loadEmails(
      'testtask.2.1@mail.uprent.ai',
      '123123123',
    )
    return res.ok({
      emails,
    })
  },
  { response: res(resDTO) },
)
