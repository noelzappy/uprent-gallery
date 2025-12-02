import db from '@/db/setup-db'
import { sleep } from 'bun'
import { ImapAccount } from '~core/database/data-types/email'

const emailSyncWorker = new Worker(
  new URL('./email-sync.worker.ts', import.meta.url).href,
)

self.onmessage = async (event: MessageEvent) => {
  if (event.data !== 'start-sync') return
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

      for (const emailAccount of emailAccounts) {
        emailSyncWorker.postMessage(emailAccount.id)
        await sleep(100)
      }

      offset += limit
    }
  } catch (error) {
    console.error('Error in email sync worker:', error)
  }
}
