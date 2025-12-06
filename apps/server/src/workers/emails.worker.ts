import db from '@/database/db'
import { type Email } from '~core/database'
import {
  ImapAccount,
  ImapConnectionParams,
} from '~core/database/data-types/email'
import { emailServer } from '~integrations/email-server'
import { decrypt, importEncryptionKey } from '~utils'

const RETRY_OPTIONS = {
  retries: 3,
  delay: 300,
  backoffMultiplier: 1.3,
}

async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries: number
    delay: number
    backoffMultiplier?: number
  } = RETRY_OPTIONS,
): Promise<T> {
  let lastError: any
  const backoff = options.backoffMultiplier || 1

  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (i < options.retries - 1) {
        const waitTime = options.delay * Math.pow(backoff, i)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }
  throw lastError
}

async function syncEmailAccount(emailAccount: ImapAccount) {
  try {
    const lastSyncedUidRow = db
      .query<{ maxUid: number | null }, any>(
        `
        SELECT MAX(imapUid) as maxUid
        FROM emails
        WHERE bodyHtml IS NOT NULL AND emailAccountId = ? AND mailbox = ?
      `,
      )
      .get(emailAccount.id, 'INBOX') as { maxUid: number | null }

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

    const { UIDs } = await retry(() =>
      emailServer.getInboxStats(connectionParams),
    )
    console.log(
      `Account ${emailAccount.emailAddress} has ${UIDs.length} emails on server.`,
    )

    const uidsToFetchSet = new Set(
      UIDs.filter(
        uid => !lastSyncedUidRow?.maxUid || uid > lastSyncedUidRow.maxUid,
      ),
    )

    if (uidsToFetchSet.size === 0) {
      console.log(
        `No new emails to sync for account ${emailAccount.emailAddress}.`,
      )
      return
    }

    const uidsToFetch = Array.from(uidsToFetchSet).reverse()
    console.log(
      `Syncing ${uidsToFetch.length} emails for ${emailAccount.emailAddress}`,
    )

    const HEADER_BATCH_SIZE = 50
    for (let i = 0; i < uidsToFetch.length; i += HEADER_BATCH_SIZE) {
      const batchUids = uidsToFetch.slice(i, i + HEADER_BATCH_SIZE)
      await fetchAndSaveHeaders(batchUids, connectionParams, emailAccount)
    }

    const emailsNeedingBodies = db
      .query<{ imapUid: number }, any>(
        `SELECT imapUid FROM emails 
         WHERE emailAccountId = ? AND mailbox = ? 
         AND bodyHtml IS NULL AND imapUid IN (${uidsToFetch.map(() => '?').join(',')})
         ORDER BY imapUid DESC`,
      )
      .all(emailAccount.id, 'INBOX', ...uidsToFetch) as { imapUid: number }[]

    if (emailsNeedingBodies.length > 0) {
      console.log(`Fetching bodies for ${emailsNeedingBodies.length} emails...`)
      const BODY_BATCH_SIZE = 7
      const bodyUids = emailsNeedingBodies.map(e => e.imapUid)

      for (let i = 0; i < bodyUids.length; i += BODY_BATCH_SIZE) {
        const batchUids = bodyUids.slice(i, i + BODY_BATCH_SIZE)
        await fetchAndSaveBodies(batchUids, connectionParams, emailAccount)
      }
    }

    console.log(`Completed sync for account ${emailAccount.emailAddress}.`)
  } catch (error) {
    console.error(`Error syncing account ${emailAccount.id}:`, error)
  }
}

async function fetchAndSaveHeaders(
  uids: number[],
  connectionParams: ImapConnectionParams,
  emailAccount: ImapAccount,
): Promise<void> {
  const emails = await retry(() =>
    emailServer.loadEmailHeaders(connectionParams, uids),
  )

  if (emails.length === 0) return

  const headerTransaction = db.transaction((items: Email[]) => {
    const insertStmt = db.prepare(`
      INSERT INTO emails
      (emailAccountId, emailAddress, mailbox, imapUid, messageId, date, subject, 
       fromName, fromEmail, toJson, ccJson, inReplyTo, refs, flagsJson, 
       attachmentJson, hasAttachments, seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(emailAccountId, mailbox, imapUid) DO UPDATE SET
        messageId = excluded.messageId,
        date = excluded.date,
        subject = excluded.subject,
        fromName = excluded.fromName,
        fromEmail = excluded.fromEmail,
        toJson = excluded.toJson,
        ccJson = excluded.ccJson,
        inReplyTo = excluded.inReplyTo,
        refs = excluded.refs,
        flagsJson = excluded.flagsJson,
        attachmentJson = excluded.attachmentJson,
        hasAttachments = excluded.hasAttachments,
        seen = excluded.seen
    `)

    for (const email of items) {
      insertStmt.run(
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
        email.attachments && email.attachments.length > 0 ? 1 : 0,
        email.seen ? 1 : 0,
      )
    }
  })

  headerTransaction(emails)
}

async function fetchAndSaveBodies(
  uids: number[],
  connectionParams: ImapConnectionParams,
  emailAccount: ImapAccount,
): Promise<void> {
  const emailBodies = await retry(() =>
    emailServer.fetchEmailBodies({
      connectionParams,
      emailUids: uids,
    }),
  )

  const bodyTransaction = db.transaction(
    (items: { uid: number; body: string; attachments: any[] }[]) => {
      const updateStmt = db.prepare(`
        UPDATE emails
        SET bodyHtml = ?, attachmentJson = ?, hasAttachments = ?
        WHERE emailAccountId = ? AND mailbox = ? AND imapUid = ?
      `)

      for (const item of items) {
        updateStmt.run(
          item.body,
          JSON.stringify(item.attachments),
          item.attachments.length > 0 ? 1 : 0,
          emailAccount.id,
          'INBOX',
          item.uid,
        )
      }
    },
  )

  const bodyItems = Object.entries(emailBodies).map(
    ([uid, { body, attachments }]) => ({
      uid: Number(uid),
      body,
      attachments: attachments || [],
    }),
  )

  bodyTransaction(bodyItems)

  const emailsWithAttachments = bodyItems.filter(
    item => item.attachments.length > 0,
  )

  if (emailsWithAttachments.length > 0) {
    const CONCURRENT_EMAILS = 3
    for (let i = 0; i < emailsWithAttachments.length; i += CONCURRENT_EMAILS) {
      const batch = emailsWithAttachments.slice(i, i + CONCURRENT_EMAILS)
      await Promise.all(
        batch.map(item =>
          downloadAttachmentsForEmail(
            item.uid,
            item.attachments,
            connectionParams,
            emailAccount,
          ),
        ),
      )
    }
  }
}

async function downloadAttachmentsForEmail(
  emailUid: number,
  attachments: any[],
  connectionParams: ImapConnectionParams,
  emailAccount: ImapAccount,
): Promise<void> {
  try {
    const attachmentPaths = await retry(() =>
      emailServer.fetchAndSaveAttachmentsBulk({
        connectionParams,
        attachmentGroups: [{ emailUid, attachments }],
      }),
    )

    const paths = attachmentPaths.get(emailUid)
    if (!paths) return

    const attachmentInsertStmt = db.prepare(`
      INSERT INTO attachments
      (emailId, partId, filename, mimeType, size, storagePath)
      VALUES (
        (SELECT id FROM emails WHERE emailAccountId = ? AND mailbox = ? AND imapUid = ?),
        ?, ?, ?, ?, ?
      )
      ON CONFLICT DO NOTHING
    `)

    const attachmentTransaction = db.transaction(() => {
      for (const att of attachments) {
        const path = paths.get(att.partNumber)
        if (path) {
          attachmentInsertStmt.run(
            emailAccount.id,
            'INBOX',
            emailUid,
            att.partNumber || '',
            att.filename || null,
            att.contentType || null,
            att.size || null,
            path,
          )
        }
      }
    })

    attachmentTransaction()
  } catch (error) {
    console.error(
      `Failed to download attachments for email ${emailUid}:`,
      error,
    )
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

    const emailAccounts = db
      .query('SELECT * FROM email_accounts')
      .all() as ImapAccount[]

    await Promise.all(
      emailAccounts.map(emailAccount =>
        retry(() => syncEmailAccount(emailAccount)),
      ),
    )
  } catch (error) {
    console.error('Error in email sync worker:', error)
  }
}

async function getConnectionParamsByUid(emailUid: number) {
  const email = db
    .query('SELECT * FROM emails WHERE imapUid = ?')
    .get(emailUid) as {
    emailAccountId: number
    imapUid: number
  }
  if (!email) throw new Error('Email not found')

  const emailAccount = db
    .query('SELECT * FROM email_accounts WHERE id = ?')
    .get(email.emailAccountId) as ImapAccount
  if (!emailAccount) throw new Error('Email account not found')

  const passwordDecryptionKey = await importEncryptionKey(
    Bun.env.ENCRYPTION_KEY!,
  )
  const password = await decrypt(emailAccount.password, passwordDecryptionKey)

  return {
    connectionParams: {
      username: emailAccount.username,
      password,
      host: emailAccount.imapHost,
      port: emailAccount.imapPort,
    },
    imapUid: email.imapUid,
  }
}

async function markAsSeen(emailUid: number) {
  try {
    const { connectionParams, imapUid } =
      await getConnectionParamsByUid(emailUid)
    await retry(() => emailServer.markEmailAsSeen(connectionParams, imapUid))

    const email = db
      .query('SELECT flagsJson FROM emails WHERE imapUid = ?')
      .get(emailUid) as { flagsJson: string }
    if (!email) return
    const flags = JSON.parse(email.flagsJson) as string[]
    if (!flags.includes('\\Seen')) {
      flags.push('\\Seen')
      db.query('UPDATE emails SET flagsJson = ? WHERE imapUid = ?').run(
        JSON.stringify(flags),
        emailUid,
      )
    }
  } catch (error) {
    console.error('Error marking email as seen:', error)
  }
}

async function markAsUnseen(emailUid: number) {
  try {
    const { connectionParams, imapUid } =
      await getConnectionParamsByUid(emailUid)
    await retry(() => emailServer.markEmailAsUnseen(connectionParams, imapUid))

    const email = db
      .query('SELECT flagsJson FROM emails WHERE imapUid = ?')
      .get(emailUid) as { flagsJson: string }
    if (!email) return
    let flags = JSON.parse(email.flagsJson) as string[]
    flags = flags.filter(f => f !== '\\Seen')
    db.query('UPDATE emails SET flagsJson = ? WHERE imapUid = ?').run(
      JSON.stringify(flags),
      emailUid,
    )
  } catch (error) {
    console.error('Error marking email as unseen:', error)
  }
}

async function deleteEmail(emailUid: number) {
  try {
    const { connectionParams, imapUid } =
      await getConnectionParamsByUid(emailUid)
    await retry(() => emailServer.deleteEmail(connectionParams, imapUid))

    db.query('UPDATE emails SET deleted = 1 WHERE imapUid = ?').run(emailUid)
  } catch (error) {
    console.error('Error deleting email:', error)
  }
}

async function syncOneInbox(emailUserName: string) {
  const emailAccount = db
    .query('SELECT * FROM email_accounts WHERE emailAddress = ?')
    .get(emailUserName) as ImapAccount
  if (!emailAccount) {
    throw new Error('No email account found for the given email address.')
  }
  await syncEmailAccount(emailAccount)
}

declare var self: Worker

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } =
    typeof event.data === 'string'
      ? { type: event.data, payload: null }
      : event.data

  switch (type) {
    case 'sync':
      if (payload?.emailUserName) {
        await syncOneInbox(payload.emailUserName)
      } else {
        await initSyncAll()
      }

      self.postMessage({
        type: 'syncComplete',
        payload: {
          emailUserName: payload?.emailUserName || null,
          timestamp: Date.now(),
        },
      })

      break
    case 'markAsSeen':
      if (payload?.emailUid) await markAsSeen(payload.emailUid)
      break
    case 'markAsUnseen':
      if (payload?.emailUid) await markAsUnseen(payload.emailUid)
      break
    case 'deleteEmail':
      if (payload?.emailUid) await deleteEmail(payload.emailUid)
      break
  }
}
