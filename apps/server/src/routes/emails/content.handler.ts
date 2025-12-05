import { t, Elysia } from 'elysia'
import { corePlugin, res } from '@/plugins'
import { EMAIL_CATEGORY } from '~core/database'
import type {
  EmailAttachmentDBRecord,
  EmailDBRecord,
} from '~core/database/data-types/email'
import { statePlugin } from '@/state'

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
})

const reqParamsDTO = t.Object({
  uid: t.Number(),
})

const attachmentResDTO = t.Object({
  attachments: t.Array(
    t.Object({
      id: t.Number(),
      emailId: t.Number(),
      partId: t.String(),
      filename: t.Optional(t.String()),
      mimeType: t.Optional(t.String()),
      size: t.Optional(t.Number()),
      storagePath: t.Optional(t.String()),
      createdAt: t.String(),
    }),
  ),
})

export const fetchEmailContentHandler = new Elysia()
  .use(statePlugin)
  .use(corePlugin)
  .get(
    '/emails/content/:uid',
    async ({ res, params, db }) => {
      const { uid } = params

      if (!uid) {
        return res.badRequest("'uid' parameter is required")
      }

      const result = db
        .query(
          `
        SELECT *
        FROM emails
        WHERE imapUid = ?
      `,
        )
        .get(uid) as EmailDBRecord | undefined

      if (!result) {
        return res.notFound('Email not found')
      }

      return res.ok({
        email: {
          id: result.id,
          uid: result.imapUid,
          seen: result.flagsJson
            ? (JSON.parse(result.flagsJson) as string[]).includes('\\Seen')
            : false,
          categories: result.categoriesJson
            ? (JSON.parse(result.categoriesJson) as EMAIL_CATEGORY[])
            : undefined,
          messageId: result.messageId || '',
          datetime: result.date || '',
          subject: result.subject || '',
          from: {
            name: result.fromName || undefined,
            email: result.fromEmail || '',
          },
          to: result.toJson
            ? (JSON.parse(result.toJson) as { name?: string; email: string }[])
            : [],
          cc: result.ccJson
            ? (JSON.parse(result.ccJson) as string[])
            : undefined,
          inReplyTo: result.inReplyTo || undefined,
          references: result.refs
            ? (JSON.parse(result.refs) as string[])
            : undefined,
          flags: result.flagsJson
            ? (JSON.parse(result.flagsJson) as string[])
            : [],
          content: result.bodyHtml || '',
          attachments: result.attachmentJson
            ? JSON.parse(result.attachmentJson)
            : [],
        },
      })
    },
    { response: res(resDTO), params: reqParamsDTO },
  )
  .get(
    '/emails/content/:uid/attachments',
    async ({ res, params, db }) => {
      const { uid } = params

      if (!uid) {
        return res.badRequest("'uid' parameter is required")
      }

      const result = db
        .query(
          `
        SELECT *
        FROM attachments
        WHERE emailId = (
          SELECT id FROM emails WHERE imapUid = ?
        )
      `,
        )
        .all(uid) as EmailAttachmentDBRecord[] | undefined

      if (!result) {
        return res.notFound('Email not found')
      }
      return res.ok({
        attachments: result,
      })
    },
    {
      response: res(attachmentResDTO),
      params: reqParamsDTO,
    },
  )
  .get(
    '/emails/attachment/:id',
    async ({ res, params, db }) => {
      const { id } = params

      const attachment = db
        .query('SELECT * FROM attachments WHERE id = ?')
        .get(id) as EmailAttachmentDBRecord | undefined

      if (!attachment || !attachment.storagePath) {
        return res.notFound('Attachment not found')
      }

      return Bun.file(attachment.storagePath)
    },
    {
      params: t.Object({
        id: t.Number(),
      }),
    },
  )
