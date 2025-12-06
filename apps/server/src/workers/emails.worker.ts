import db from '@/database/db'
import { type Email } from '~core/database'
import { ImapAccount } from '~core/database/data-types/email'
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

async function syncEmailAccount(accountId: number) {
  try {
    const emailAccount = db
      .query('SELECT * FROM email_accounts WHERE id = ?')
      .get(accountId) as ImapAccount
    if (!emailAccount) {
      throw new Error('No email account found for the given ID.')
    }

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

    const uidsToFetch = UIDs.filter(
      uid => !lastSyncedUidRow?.maxUid || uid > lastSyncedUidRow.maxUid,
    ).reverse()

    if (uidsToFetch.length === 0) {
      console.log(
        `No new emails to sync for account ${emailAccount.emailAddress}.`,
      )
      return
    }

    console.log(
      `Syncing ${uidsToFetch.length} new emails for account ${emailAccount.emailAddress}...`,
    )

    const pendingEmailsForBodySync: (Email & { dbId: number })[] = []
    let headersFinished = false

    const fetchHeadersTask = async () => {
      const HEADER_CHUNK_SIZE = 50
      for (let i = 0; i < uidsToFetch.length; i += HEADER_CHUNK_SIZE) {
        const chunkUids = uidsToFetch.slice(i, i + HEADER_CHUNK_SIZE)
        const emails = await fetchAndSaveHeaders(
          chunkUids,
          connectionParams,
          emailAccount,
        )
        pendingEmailsForBodySync.push(...emails)

        while (pendingEmailsForBodySync.length > 100) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      headersFinished = true
    }

    const fetchBodiesTask = async () => {
      const BODY_CHUNK_SIZE = 5
      while (!headersFinished || pendingEmailsForBodySync.length > 0) {
        if (pendingEmailsForBodySync.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 200))
          continue
        }

        const batch = pendingEmailsForBodySync.splice(0, BODY_CHUNK_SIZE)
        await processBodyBatch(batch, connectionParams)
      }
    }

    await Promise.all([fetchHeadersTask(), fetchBodiesTask()])
  } catch (error) {
    console.error(`Error syncing account ${accountId}:`, error)
  }
}

async function fetchAndSaveHeaders(
  uids: number[],
  connectionParams: any,
  emailAccount: ImapAccount,
): Promise<(Email & { dbId: number })[]> {
  try {
    const emails = await retry(() =>
      emailServer.loadEmailHeaders(connectionParams, uids),
    )

    const result: (Email & { dbId: number })[] = []

    const headerTransaction = db.transaction((items: Email[]) => {
      for (const email of items) {
        const savedEmail = db
          .query<{ id: number }, any[]>(
            `
          INSERT OR REPLACE INTO emails
          (emailAccountId, emailAddress, mailbox, imapUid, messageId, date, subject, fromName, fromEmail, toJson, ccJson, inReplyTo, refs, flagsJson, attachmentJson)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
          )
          .get([
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

        if (savedEmail) {
          result.push({ ...email, dbId: savedEmail.id })
          try {
            self.postMessage({
              type: 'emailSynced',
              payload: {
                id: savedEmail.id,
                imapUid: email.uid,
                subject: email.subject,
                datetime: email.datetime,
                from: email.from,
              },
            })
          } catch (err) {
            console.error('Error posting emailSynced message:', err)
          }
        }
      }
    })

    headerTransaction(emails)
    return result
  } catch (error) {
    console.error('Error fetching/saving headers:', error)
    return []
  }
}

async function processBodyBatch(
  emails: (Email & { dbId: number })[],
  connectionParams: any,
) {
  try {
    const bodyResults = await Promise.all(
      emails.map(async email => {
        try {
          const body = await retry(() =>
            emailServer.fetchEmailBody({
              connectionParams,
              emailUid: email.uid,
            }),
          )

          const processedAttachments = []
          for (const att of email.attachments || []) {
            const path = await retry(() =>
              emailServer.fetchAndSaveAttachment({
                connectionParams,
                emailUid: email.uid,
                attachment: att,
              }),
            )
            processedAttachments.push({ ...att, storagePath: path })
          }

          return { dbId: email.dbId, body, attachments: processedAttachments }
        } catch (err) {
          console.error(
            `Failed to fetch details for email UID ${email.uid}. Skipping body.`,
            err,
          )
          return null
        }
      }),
    )

    const bodyTransaction = db.transaction(
      (items: { dbId: number; body: string; attachments: any[] }[]) => {
        for (const item of items) {
          if (!item) continue

          db.query('UPDATE emails SET bodyHtml = ? WHERE id = ?').run(
            item.body,
            item.dbId,
          )

          for (const att of item.attachments) {
            db.query(
              `
          INSERT OR REPLACE INTO attachments
          (emailId, partId, filename, mimeType, size, storagePath)
          VALUES ( ?, ?, ?, ?, ?, ? )
        `,
            ).run(
              item.dbId,
              att.partNumber || null,
              att.filename || null,
              att.contentType || null,
              att.size || null,
              att.storagePath || null,
            )
          }
        }
      },
    )

    bodyTransaction(bodyResults)
  } catch (error) {
    console.error('Error processing body batch:', error)
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
        emailAccounts.map(emailAccount =>
          retry(() => syncEmailAccount(emailAccount.id)),
        ),
      )

      offset += limit
    }
  } catch (error) {
    console.error('Error in email sync worker:', error)
  }
}

async function getConnectionParams(emailUid: number) {
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
    const { connectionParams, imapUid } = await getConnectionParams(emailUid)
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
    const { connectionParams, imapUid } = await getConnectionParams(emailUid)
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
    const { connectionParams, imapUid } = await getConnectionParams(emailUid)
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
  await syncEmailAccount(emailAccount.id)
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
