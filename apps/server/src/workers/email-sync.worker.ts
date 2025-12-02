import db from '@/db/setup-db'
import { ImapAccount } from '~core/database/data-types/email'
import { emailServer } from '~integrations/email-server'
import { decrypt, importEncryptionKey } from '~utils'

self.onmessage = async (event: MessageEvent<ImapAccount['id']>) => {
  const startTime = Date.now()
  try {
    const emailAccount = db
      .query('SELECT * FROM email_accounts WHERE id = ?')
      .get(event.data) as ImapAccount
    if (!emailAccount) {
      throw new Error('No email account found for the given ID.')
    }

    const lastSyncedUidRow = db
      .query<
        { maxUid: number | null; minUid: number | null },
        [ImapAccount['id'], string]
      >(
        `
        SELECT MIN(imapUid) as minUid, MAX(imapUid) as maxUid
        FROM emails
        WHERE emailAccountId = ? AND mailbox = ?
      `,
      )
      .get(emailAccount.id, 'INBOX')

    const passwordDecryptionKey = await importEncryptionKey(
      Bun.env.ENCRYPTION_KEY!,
    )

    const password = await decrypt(emailAccount.password, passwordDecryptionKey)

    const connectionParams = {
      username: emailAccount.username,
      password,
      host: emailAccount.imap_host,
      port: emailAccount.imap_port,
    }

    const uids = await emailServer.getUIDs(
      connectionParams,
      10,
      // lastSyncedUidRow?.minUid || undefined,
    )

    const emails = await emailServer.loadEmails(connectionParams, uids)
    for (const email of emails) {
      const savedEmail = db
        .query<{ id: number }, any[]>(
          `
          INSERT INTO emails
          (emailAccountId, emailAddress, mailbox, imapUid, messageId, date, subject, fromName, fromEmail, toJson, ccJson, inReplyTo, refs, flagsJson, attachmentJson)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        )
        .run([
          emailAccount.id,
          emailAccount.email_address,
          'INBOX',
          email.uid,
          email.messageId,
          email.datetime,
          email.subject,
          email.from.name || null,
          email.from.email,
          JSON.stringify(email.to),
          email.cc ? JSON.stringify(email.cc) : null,
          email.inReplyTo || null,
          email.references ? JSON.stringify(email.references) : null,
          JSON.stringify(email.flags),
          email.attachments ? JSON.stringify(email.attachments) : null,
        ])

      const body = await emailServer.fetchEmailBody({
        connectionParams,
        emailUid: email.uid,
      })

      db.query(
        `
        UPDATE emails
        SET bodyPlain = ?, bodyHtml = ?
        WHERE id = ?
      `,
      ).run(body || null, savedEmail.lastInsertRowid)

      for (const att of email?.attachments || []) {
        const path = await emailServer.fetchAndSaveAttachment({
          connectionParams,
          emailUid: email.uid,
          attachment: att,
        })

        console.log('Attachment saved to:', path)

        db.query(
          `
          INSERT INTO attachments
          (emailId, partId, filename, mimeType, size, storagePath)
          VALUES (
            (SELECT id FROM emails WHERE emailAccountId = ? AND mailbox = 'INBOX' AND imapUid = ?),
            ?, ?, ?, ?, ?
          )
        `,
        ).run(
          savedEmail.lastInsertRowid,
          att.partNumber || null,
          att.filename || null,
          att.contentType || null,
          att.size || null,
          path || null,
        )
      }
    }
  } catch (error) {
    console.error('Error fetching emails:', error)
  }
}
