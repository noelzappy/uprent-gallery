import db from '@/db/setup-db'
import { ImapAccount } from '~core/database/data-types/email'
import { emailServer } from '~integrations/email-server'
import { decrypt, importEncryptionKey } from '~utils'

self.onmessage = async (event: MessageEvent<ImapAccount>) => {
  try {
    const passwordDecryptionKey = await importEncryptionKey(
      Bun.env.ENCRYPTION_KEY!,
    )

    const emailAccount = event.data
    if (!emailAccount) {
      throw new Error('No email account data received in worker.')
    }
    const password = await decrypt(emailAccount.password, passwordDecryptionKey)

    const connectionParams = {
      username: emailAccount.username,
      password,
      host: emailAccount.imap_host,
      port: emailAccount.imap_port,
    }

    const startTime = Date.now()

    const result = await emailServer.loadEmails({
      connectionParams,
      limit: 10,
    })

    const syncTime = Date.now() - startTime
    console.log(`Synced ${result.emails.length} emails in ${syncTime}ms`)

    for (const email of result.emails) {
      const res = db
        .query(
          `
          INSERT OR IGNORE INTO emails
          (email_account_id, mailbox, imap_uid, message_id, date, subject, from_name, from_email, to_json, cc_json, in_reply_to, refs, flags_json, attachment_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          emailAccount.id,
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
        )

      if (!email.attachments) continue

      for (const attachment of email.attachments) {
        const attRes = await db
          .query(
            `
          INSERT OR IGNORE INTO attachments
          (email_id, part_id, filename, mime_type, size, storage_path)
          VALUES (
            (SELECT id FROM emails WHERE email_account_id = ? AND mailbox = 'INBOX' AND imap_uid = ?),
            ?, ?, ?, ?, ?
          )
        `,
          )
          .run(
            emailAccount.id,
            email.uid,
            attachment.partNumber || null,
            attachment.filename || null,
            attachment.contentType || null,
            attachment.size || null,
            attachment.path || null,
          )
      }
    }

    if (result.emails.length > 0) {
      console.log('\n📥 Fetching body for first email...')
      const bodyStart = Date.now()

      const body = await emailServer.fetchEmailBody({
        connectionParams,
        emailUid: result.emails[0].uid,
      })

      const bodyTime = Date.now() - bodyStart
      console.log(`✅ Fetched body in ${bodyTime}ms`)
      console.log(`   Length: ${body.length} chars`)
    }
  } catch (error) {
    console.error('Error fetching emails:', error)
  }
}
