import db from '@/db/setup-db'
import { ImapAccount } from '~core/database/data-types/email'

const emailSyncWorker = new Worker(
  new URL('./email-sync.worker.ts', import.meta.url).href,
)

self.onmessage = async (event: MessageEvent) => {
  if (event.data !== 'start-sync') return
  try {
    const emailAccounts = db
      .prepare('SELECT * FROM email_accounts')
      .all() as ImapAccount[]

    for (const emailAccount of emailAccounts) {
      emailSyncWorker.postMessage(emailAccount)
    }
  } catch (error) {
    console.error('Error in email sync worker:', error)
  }
}
