import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'
import { EMAIL_CATEGORY } from '~core/database'
import { EmailDBRecord } from '~core/database/data-types/email'
import { statePlugin } from '@/state'

const emailHeadersResDTO = t.Object({
  emails: t.Array(
    t.Object({
      id: t.Number(),
      seen: t.Boolean(),
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
      attachments: t.Optional(
        t.Array(
          t.Object({
            uid: t.Number(),
            contentType: t.String(),
            filename: t.Optional(t.String()),
            size: t.Number(),
            contentId: t.Optional(t.String()),
            related: t.Optional(t.Boolean()),
          }),
        ),
      ),
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

export const loadEmailsHandler = new Elysia()
  .use(statePlugin)
  .use(corePlugin)

  .get(
    '/emails/load',
    async ({ res, query, db }) => {
      const { cursor, limit } = query

      // Idealy, this should come from authenticated user context
      const emailUserName = Bun.env.EMAIL_USERNAME!

      const pageSize = limit || 20
      const offset = cursor || 0

      const result = db
        .query(
          `
      SELECT 
        id, imapUid, categoriesJson, messageId, date, subject, fromName, fromEmail, toJson, ccJson, inReplyTo, refs, flagsJson, attachmentJson,
        COUNT(*) OVER() as totalCount
      FROM emails 
      WHERE emailAddress = ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `,
        )
        .all(emailUserName, pageSize, offset) as (EmailDBRecord & {
        totalCount: number
      })[]

      const totalEmails = result.length > 0 ? result[0].totalCount : 0
      const hasMore = offset + pageSize < totalEmails

      return res.ok({
        emails: result.map(row => ({
          id: row.id,
          uid: row.imapUid,
          seen: row.flagsJson
            ? (JSON.parse(row.flagsJson) as string[]).includes('\\Seen')
            : false,
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
          attachments: row.attachmentJson ? JSON.parse(row.attachmentJson) : [],
        })),
        paging: {
          cursor: offset + result.length,
          hasMore,
        },
      })
    },
    { response: res(emailHeadersResDTO), query: emailReqQueryDTO },
  )
  .post('/emails/sync', async ({ emailWorker, db }) => {
    // Should ideally come from authenticated user context
    const emailUserName = Bun.env.EMAIL_USERNAME!

    emailWorker.postMessage({ type: 'sync', payload: { emailUserName } })

    return { success: true }
  })
