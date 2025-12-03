import db from '@/database/db'
import { ImapAccount } from '~core/database/data-types/email'
import { emailServer } from '~integrations/email-server'
import { decrypt, importEncryptionKey } from '~utils'

async function syncEmailAccount(accountId: number) {
  const startTime = Date.now()
  try {
    const emailAccount = db
      .query('SELECT * FROM email_accounts WHERE id = ?')
      .get(accountId) as ImapAccount
    if (!emailAccount) {
      throw new Error('No email account found for the given ID.')
    }

    const lastSyncedUidRow = db
      .query<{ maxUid: number | null }, [ImapAccount['id'], string]>(
        `
        SELECT MAX(imapUid) as maxUid
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
      host: emailAccount.imapHost,
      port: emailAccount.imapPort,
    }

    const { UIDs } = await emailServer.getInboxStats(connectionParams)

    const uidsToFetch = UIDs.filter(
      uid => !lastSyncedUidRow?.maxUid || uid > lastSyncedUidRow.maxUid,
    )

    if (uidsToFetch.length === 0) {
      console.log(
        `No new emails to sync for account ${emailAccount.emailAddress}.`,
      )
      return
    }

    console.log(
      `Syncing ${uidsToFetch.length} new emails for account ${emailAccount.emailAddress}...`,
    )

    const emails = await emailServer.loadEmails(connectionParams, uidsToFetch)
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
          emailAccount.emailAddress,
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
        SET bodyHtml = ?
        WHERE id = ?
      `,
      ).run(body || null, savedEmail.lastInsertRowid)

      for (const att of email?.attachments || []) {
        const path = await emailServer.fetchAndSaveAttachment({
          connectionParams,
          emailUid: email.uid,
          attachment: att,
        })

        db.query(
          `
          INSERT INTO attachments
          (emailId, partId, filename, mimeType, size, storagePath)
          VALUES ( ?, ?, ?, ?, ?, ? )
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

export async function initSyncAll() {
  try {
    const allEmailAccountsCount = db
      .query('SELECT COUNT(*) as count FROM email_accounts')
      .get() as { count: number }

    if (allEmailAccountsCount.count === 0) {
      console.log('No email accounts to sync.')
      return
    }

    // This is to simulate a batch processing of email accounts
    const limit = 5
    let offset = 0
    while (offset < allEmailAccountsCount.count) {
      const emailAccounts = db
        .query('SELECT * FROM email_accounts LIMIT ? OFFSET ?')
        .all(limit, offset) as ImapAccount[]

      await Promise.all(
        emailAccounts.map(emailAccount => syncEmailAccount(emailAccount.id)),
      )

      offset += limit
    }
  } catch (error) {
    console.error('Error in email sync worker:', error)
  }
}

declare var self: Worker

self.onmessage = async (event: MessageEvent) => {
  if (event.data === 'sync') {
    await initSyncAll()
    self.postMessage('done')
  }
}
