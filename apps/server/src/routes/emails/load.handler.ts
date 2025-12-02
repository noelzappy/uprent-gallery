import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'
import { EMAIL_CATEGORY } from '~core/database'
import db from '@/db/setup-db'

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
  cursor: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})

export const loadEmailsHandler = new Elysia().use(corePlugin).get(
  '/emails/load',
  async ({ res, query }) => {
    const { cursor, limit } = query

    // Idealy, this should come from authenticated user context
    const emailUserName = Bun.env.EMAIL_USERNAME!

    const result = db
      .query(
        `
      SELECT imap_uid, categories_json, message_id, date, subject, from_name, from_email, to_json, cc_json, in_reply_to, refs, flags_json
      FROM emails
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `,
      )
      .all(limit || 20, cursor || 0) as {
      uid: number
      seen: boolean
      categories_json: string | null
      message_id: string
      date: string
      subject: string
      from_name: string | null
      from_email: string
      to_json: string | null
      cc_json: string | null
      in_reply_to: string | null
      refs: string | null
      flags_json: string | null
    }[]

    console.log(`Loaded ${result.length} email headers from DB`)

    return res.ok({
      emailHeaders: [],
      paging: {
        cursor: (cursor || 0) + (limit || 20),
        hasMore: false,
      },
    })
  },
  { response: res(emailHeadersResDTO), query: emailReqQueryDTO },
)
