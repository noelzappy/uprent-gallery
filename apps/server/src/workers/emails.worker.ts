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
  delay: 500,
}

async function retry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number } = RETRY_OPTIONS,
): Promise<T> {
  let lastError: any
  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      console.warn(`Retry attempt ${i + 1} failed:`, error)
      await new Promise(resolve => setTimeout(resolve, options.delay * (i + 1)))
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
    const uidsToFetch = UIDs.filter(
      uid => !lastSyncedUidRow?.maxUid || uid < lastSyncedUidRow.maxUid,
    ).reverse()

    if (uidsToFetch.length === 0) {
      console.log(
        `No new emails to sync for account ${emailAccount.emailAddress}.`,
      )
      return
    }
    const processHeader = async (uids: number[]) => {
      const BATCH_SIZE = 5
      for (let i = 0; i < uids.length; i += BATCH_SIZE) {
        const batchUids = uids.slice(i, i + BATCH_SIZE)
        await fetchAndSaveHeaders(batchUids, connectionParams, emailAccount)
      }
    }

    const processBody = async (uids: number[]) => {
      const BATCH_SIZE = 2
      for (let i = 0; i < uids.length; i += BATCH_SIZE) {
        const batchUids = uids.slice(i, i + BATCH_SIZE)
        await fetchAndSaveEmailBody(batchUids, connectionParams, emailAccount)
      }
    }

    await processHeader(uidsToFetch)
    await processBody(uidsToFetch)

    console.log(`Completed sync for account ${emailAccount.emailAddress}.`)
  } catch (error) {
    console.error(`Error syncing account ${emailAccount.id}:`, error)
  }
}

const fetchAndSaveEmailBody = async (
  uids: number[],
  connectionParams: ImapConnectionParams,
  emailAccount: ImapAccount,
) => {
  const emailBodies = await retry(() =>
    emailServer.fetchEmailBodies({
      connectionParams,
      emailUids: uids,
    }),
  )

  const saveBodyTransaction = db.transaction(
    (items: { uid: number; body: string; attachments: any[] }[]) => {
      for (const item of items) {
        db.query(
          `
              INSERT INTO emails
              (bodyHtml, attachmentJson, imapUid, emailAccountId, mailbox, emailAddress)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(emailAccountId, mailbox, imapUid) DO UPDATE SET
                bodyHtml = excluded.bodyHtml,
                attachmentJson = excluded.attachmentJson
            `,
        ).run(
          item.body,
          JSON.stringify(item.attachments),
          item.uid,
          emailAccount.id,
          'INBOX',
          emailAccount.emailAddress,
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

  await saveBodyTransaction(bodyItems)

  const emailAttachments = bodyItems.flatMap(email =>
    (email.attachments || []).map(att => ({
      emailUid: email.uid,
      attachment: att,
    })),
  )

  for (const att of emailAttachments) {
    const path = await retry(() =>
      emailServer.fetchAndSaveAttachment({
        connectionParams,
        emailUid: att.emailUid,
        attachment: att.attachment,
      }),
    )

    db.query(
      `
        INSERT INTO attachments
        (emailId, partId, filename, mimeType, size, storagePath)
        VALUES (
          (SELECT id FROM emails WHERE emailAccountId = ? AND mailbox = ? AND imapUid = ?),
          ?, ?, ?, ?, ?
        )
        ON CONFLICT(emailId, partId) DO UPDATE SET
          filename = excluded.filename,
          mimeType = excluded.mimeType,
          size = excluded.size,
          storagePath = excluded.storagePath
      `,
    ).run(
      emailAccount.id,
      'INBOX',
      att.emailUid,
      att.attachment.partNumber || '',
      att.attachment.filename || null,
      att.attachment.contentType || null,
      att.attachment.size || null,
      path,
    )
  }
}

async function fetchAndSaveHeaders(
  uids: number[],
  connectionParams: ImapConnectionParams,
  emailAccount: ImapAccount,
): Promise<void> {
  try {
    const emails = await retry(() =>
      emailServer.loadEmailHeaders(connectionParams, uids),
    )
    console.log(
      `Fetched ${emails.length} headers for account ${emailAccount.emailAddress}`,
    )
    const headerTransaction = db.transaction((items: Email[]) => {
      for (const email of items) {
        db.query<{ id: number }, any[]>(
          `
          INSERT INTO emails
          (emailAccountId, emailAddress, mailbox, imapUid, messageId, date, subject, fromName, fromEmail, toJson, ccJson, inReplyTo, refs, flagsJson, attachmentJson)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            attachmentJson = excluded.attachmentJson
          RETURNING id
        `,
        ).get([
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
      }
    })

    headerTransaction(emails)
  } catch (error) {
    console.error('Error fetching/saving headers:', error)
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

    const limit = 5
    let offset = 0
    while (offset < allEmailAccountsCount.count) {
      const emailAccounts = db
        .query('SELECT * FROM email_accounts LIMIT ? OFFSET ?')
        .all(limit, offset) as ImapAccount[]

      await Promise.all(
        emailAccounts.map(emailAccount =>
          retry(() => syncEmailAccount(emailAccount)),
        ),
      )

      offset += limit
    }
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
