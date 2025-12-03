import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'
import { Email, EMAIL_CATEGORY } from '~core/database'
import { EmailDBRecord } from '~core/database/data-types/email'
import db from '@/database/db'

const emailHeadersResDTO = t.Object({
  emails: t.Array(
    t.Object({
      id: t.Number(),
      uid: t.Number(),
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
      SELECT id, imapUid, categoriesJson, messageId, date, subject, fromName, fromEmail, toJson, ccJson, inReplyTo, refs, flagsJson
      FROM emails
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `,
      )
      .all(limit || 20, cursor || 0) as EmailDBRecord[]

    console.log(`Loaded ${result.length} email headers from DB`)

    console.log(result)

    return res.ok({
      emails: result.map(row => ({
        id: row.id,
        uid: row.imapUid,
        categories: row.categoriesJson
          ? (JSON.parse(row.categoriesJson) as EMAIL_CATEGORY[])
          : undefined,
        messageId: row.messageId || '',
        datetime: row.date || '',
        subject: row.subject || '',
        from: {
          name: row.fromName || undefined,
          email: row.fromEmail || '',
        },
        to: row.toJson
          ? (JSON.parse(row.toJson) as { name?: string; email: string }[])
          : [],
        cc: row.ccJson ? (JSON.parse(row.ccJson) as string[]) : undefined,
        inReplyTo: row.inReplyTo || undefined,
        references: row.refs ? (JSON.parse(row.refs) as string[]) : undefined,
        flags: row.flagsJson ? (JSON.parse(row.flagsJson) as string[]) : [],
      })),
      paging: {
        cursor: (cursor || 0) + (limit || 20),
        hasMore: false,
      },
    })
  },
  { response: res(emailHeadersResDTO), query: emailReqQueryDTO },
)
