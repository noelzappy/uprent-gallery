import { Database } from 'bun:sqlite'
import { encrypt, importEncryptionKey } from '~utils'

const initDatabase = (db: Database) => {
  db.run(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS email_accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email_address TEXT NOT NULL,
      imap_host     TEXT NOT NULL,
      imap_port     INTEGER NOT NULL,
      username      TEXT NOT NULL,
      password      TEXT NOT NULL,          -- Encrypted
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emails (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email_account_id    INTEGER NOT NULL,
      email_address  TEXT NOT NULL,
      mailbox       TEXT NOT NULL,          
      imap_uid      INTEGER NOT NULL,  
      categories_json    TEXT,     
      message_id    TEXT,
      subject       TEXT,
      from_name     TEXT,
      from_email    TEXT,
      to_json       TEXT,                   
      cc_json       TEXT,
      date          TEXT,                   
      flags_json    TEXT,                   
      snippet       TEXT,                   
      body_plain    TEXT,                   
      body_html     TEXT,
      in_reply_to   TEXT,
      refs          TEXT,
      attachment_json TEXT,
      size          INTEGER,                   
      has_attachments INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(email_account_id, mailbox, imap_uid),

      FOREIGN KEY (email_account_id) REFERENCES email_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id      INTEGER NOT NULL,
      part_id       TEXT NOT NULL,          
      filename      TEXT,
      mime_type     TEXT,
      size          INTEGER,
      storage_path  TEXT,                    
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id)
    );

    CREATE INDEX IF NOT EXISTS idx_emails_email_account_mailbox_uid
      ON emails (email_account_id, mailbox, imap_uid DESC);

    CREATE INDEX IF NOT EXISTS idx_emails_email_account_mailbox_date
      ON emails (email_account_id, mailbox, date DESC);
    `)
}

const db = new Database('./mail.db')

const seedDatabase = async () => {
  const insertAccount = db.prepare(`
    INSERT INTO email_accounts (email_address, imap_host, imap_port, username, password)
    VALUES (?, ?, ?, ?, ?)
  `)

  const existing = db
    .prepare(
      `SELECT COUNT(*) as count FROM email_accounts WHERE email_address = ?`,
    )
    .get(Bun.env.EMAIL_USERNAME!) as { count: number }

  if (existing.count === 0) {
    const encryptionKey = await importEncryptionKey(Bun.env.ENCRYPTION_KEY!)
    const encryptedPassword = await encrypt(
      Bun.env.EMAIL_PASSWORD!,
      encryptionKey,
    )

    insertAccount.run(
      Bun.env.EMAIL_USERNAME!,
      '172.233.33.104',
      993,
      Bun.env.EMAIL_USERNAME!,
      encryptedPassword,
    )
    console.log(`[DB] Seeded email account: ${Bun.env.EMAIL_USERNAME}`)
  }
}

if (Bun.env.EMAIL_USERNAME && Bun.env.EMAIL_PASSWORD) {
  seedDatabase()
}

export { initDatabase }
export default db
