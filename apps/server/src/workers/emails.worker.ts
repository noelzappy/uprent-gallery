import db from '@/database/db'
import { type Email } from '~core/database'
import { ImapAccount } from '~core/database/data-types/email'
import { emailServer } from '~integrations/email-server'
import { decrypt, importEncryptionKey } from '~utils'

const RETRY_OPTIONS = {
  retries: 3,
  delay: 1000,
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

    const { UIDs } = await retry(() =>
      emailServer.getInboxStats(connectionParams),
    )

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

    const CHUNK_SIZE = 10
    for (let i = 0; i < uidsToFetch.length; i += CHUNK_SIZE) {
      const chunkUids = uidsToFetch.slice(i, i + CHUNK_SIZE)
      await processEmailChunk(chunkUids, connectionParams, emailAccount)
    }
  } catch (error) {
    console.error(`Error syncing account ${accountId}:`, error)
  }
}

async function processEmailChunk(
  uids: number[],
  connectionParams: any,
  emailAccount: ImapAccount,
) {
  try {
    const emails = await retry(() =>
      emailServer.loadEmails(connectionParams, uids),
    )

    const preparedEmails: {
      email: Email
      body: string
      attachments: any[]
    }[] = []

    for (const email of emails) {
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

        preparedEmails.push({
          email,
          body,
          attachments: processedAttachments,
        })
      } catch (err) {
        console.error(
          `Failed to fetch details for email UID ${email.uid}. Skipping.`,
          err,
        )
      }
    }

    if (preparedEmails.length === 0) return

    const saveTransaction = db.transaction(
      (
        items: { email: Email; body: string; attachments: any[] }[],
        accountId: number,
        emailAddress: string,
      ) => {
        for (const { email, body, attachments } of items) {
          const savedEmail = db
            .query<{ id: number }, any[]>(
              `
          INSERT INTO emails
          (emailAccountId, emailAddress, mailbox, imapUid, messageId, date, subject, fromName, fromEmail, toJson, ccJson, inReplyTo, refs, flagsJson, attachmentJson, bodyHtml)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
            )
            .get([
              accountId,
              emailAddress,
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
              body || null,
            ])

          if (!savedEmail) continue

          for (const att of attachments) {
            db.query(
              `
          INSERT INTO attachments
          (emailId, partId, filename, mimeType, size, storagePath)
          VALUES ( ?, ?, ?, ?, ?, ? )
        `,
            ).run(
              savedEmail.id,
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

    saveTransaction(preparedEmails, emailAccount.id, emailAccount.emailAddress)
  } catch (error) {
    console.error('Error processing email chunk:', error)
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

      self.postMessage('done')
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
