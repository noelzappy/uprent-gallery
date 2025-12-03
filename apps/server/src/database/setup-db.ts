import { Database } from 'bun:sqlite'
import { encrypt, importEncryptionKey } from '~utils'

export const initDatabase = (db: Database) => {
  db.run(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS email_accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      emailAddress TEXT NOT NULL UNIQUE,
      imapHost     TEXT NOT NULL,
      imapPort     INTEGER NOT NULL,
      username      TEXT NOT NULL,
      password      TEXT NOT NULL,          -- Encrypted
      createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt    TEXT NOT NULL DEFAULT (datetime('now')),
      lastSyncedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS emails (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      emailAccountId    INTEGER NOT NULL,
      emailAddress  TEXT NOT NULL,
      mailbox       TEXT NOT NULL,          
      imapUid      INTEGER NOT NULL,  
      categoriesJson    TEXT,     
      messageId    TEXT,
      subject       TEXT,
      fromName     TEXT,
      fromEmail    TEXT,
      toJson       TEXT,                   
      ccJson       TEXT,
      date          TEXT,                   
      flagsJson    TEXT,                   
      snippet       TEXT,                   
      bodyPlain    TEXT,                   
      bodyHtml     TEXT,
      inReplyTo   TEXT,
      refs          TEXT,
      attachmentJson TEXT,
      size          INTEGER,                   
      hasAttachments INTEGER NOT NULL DEFAULT 0,
      createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(emailAccountId, mailbox, imapUid),

      FOREIGN KEY (emailAccountId) REFERENCES email_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      emailId      INTEGER NOT NULL,
      partId       TEXT NOT NULL,          
      filename      TEXT,
      mimeType     TEXT,
      size          INTEGER,
      storagePath  TEXT,                    
      createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (emailId) REFERENCES emails(id)
    );

    CREATE INDEX IF NOT EXISTS idx_emails_email_account_mailbox_uid
      ON emails (emailAccountId, mailbox, imapUid DESC);

    CREATE INDEX IF NOT EXISTS idx_emails_email_account_mailbox_date
      ON emails (emailAccountId, mailbox, date DESC);
    `)
}

export const seedDatabase = async (db: Database) => {
  const insertAccount = db.prepare(`
    INSERT INTO email_accounts (emailAddress, imapHost, imapPort, username, password)
    VALUES (?, ?, ?, ?, ?)
  `)

  const existing = db
    .prepare(
      `SELECT COUNT(*) as count FROM email_accounts WHERE emailAddress = ?`,
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
