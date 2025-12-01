import Imap from 'imap'
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'
import {
  type Email,
  type EmailAttachment,
  EMAIL_CATEGORY,
} from '~core/database'
import { catchError } from '~utils'

export class EmailServer {
  private connectionPool: Record<string, Imap> = {}
  private connectionTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}

  async loadEmails(username: string, password: string): Promise<Email[]> {
    const imap = await this.connect(username, password)

    await this.openBox(imap, 'INBOX')

    try {
      const uids = await this.search(imap, ['ALL'])

      if (!uids.length) {
        return []
      }
      const headers = await this.fetchEmailHeadersOnly(imap, uids.slice(0, 5))
      console.log(`Fetched ${headers.length} email headers for ${username}`)
      console.log(headers)

      const emails = await this.fetchAndParseEmails(imap, uids)

      return emails.sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
      )
    } finally {
      console.log(`Closing IMAP connection for ${username}`)
      await catchError(this.closeBox(imap), false)
    }
  }

  private connectAndOpenBox(
    username: string,
    password: string,
    boxName: string,
  ): Promise<Imap> {
    return new Promise<Imap>(async (resolve, reject) => {
      try {
        const imap = await this.connect(username, password)
        await this.openBox(imap, boxName)
        resolve(imap)
      } catch (err) {
        reject(err)
      }
    })
  }

  async loadEmailHeaders({
    username,
    password,
    cursor,
    limit,
  }: {
    username: string
    password: string
    cursor?: number
    limit?: number
  }): Promise<{
    emails: Email[]
    paging: {
      cursor: number
      hasMore: boolean
    }
  }> {
    const imap = await this.connectAndOpenBox(username, password, 'INBOX')

    try {
      const uids = await this.search(imap, ['ALL'])

      if (!uids.length) {
        return {
          emails: [],
          paging: {
            cursor: 0,
            hasMore: false,
          },
        }
      }

      const start = cursor ?? 0
      const end = limit ? start + limit : 10
      const sliceUids = uids.slice(start, end)

      const emails = await this.fetchEmailHeadersOnly(imap, sliceUids)

      emails.sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
      )

      return {
        emails,
        paging: {
          cursor: end,
          hasMore: end < uids.length,
        },
      }
    } finally {
      console.log(`Closing IMAP connection for ${username}`)
      await catchError(this.closeBox(imap), false)
    }
  }

  async fetchSingleEmail(
    username: string,
    password: string,
    uid: number,
  ): Promise<Email> {
    const imap = await this.connectAndOpenBox(username, password, 'INBOX')

    try {
      const emails = await this.fetchAndParseEmails(imap, [uid])

      if (emails.length === 0) {
        throw new Error(`Email with UID ${uid} not found`)
      }

      return emails[0]
    } finally {
      console.log(`Closing IMAP connection for ${username}`)
      await catchError(this.closeBox(imap), false)
    }
  }

  private async fetchEmailHeadersOnly(
    imap: Imap,
    uids: number[],
  ): Promise<Email[]> {
    return new Promise<Email[]>((resolve, reject) => {
      const fetch = imap.fetch(uids, {
        bodies: 'HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)',
        struct: false,
      })

      const emailPromises: Promise<Email | null>[] = []

      fetch.on('message', msg => {
        const promise = new Promise<Email | null>(resolveEmail => {
          let uid = 0
          let flags: string[] = []
          const chunks: Buffer[] = []

          msg.once('attributes', attrs => {
            uid = attrs.uid
            flags = attrs.flags || []
          })

          msg.on('body', stream => {
            stream.on('data', chunk => chunks.push(chunk))
          })

          msg.once('end', async () => {
            try {
              const fullSource = Buffer.concat(chunks)
              const parsed = await simpleParser(fullSource)
              const email = this.mapParsedToEmail(uid, flags, parsed)
              resolveEmail(email)
            } catch (err) {
              console.error(`Failed to parse email UID ${uid}`, err)
              resolveEmail(null)
            }
          })
        })
        emailPromises.push(promise)
      })

      fetch.once('error', err => {
        reject(err)
      })

      fetch.once('end', async () => {
        const results = await Promise.all(emailPromises)
        resolve(results.filter((e): e is Email => e !== null))
      })
    })
  }

  private async fetchAndParseEmails(
    imap: Imap,
    uids: number[],
  ): Promise<Email[]> {
    return new Promise<Email[]>((resolve, reject) => {
      const fetch = imap.fetch(uids, {
        bodies: '',
        struct: false,
      })

      const emailPromises: Promise<Email | null>[] = []

      fetch.on('message', msg => {
        const promise = new Promise<Email | null>(resolveEmail => {
          let uid = 0
          let flags: string[] = []
          const chunks: Buffer[] = []

          msg.once('attributes', attrs => {
            uid = attrs.uid
            flags = attrs.flags || []
          })

          msg.on('body', stream => {
            stream.on('data', chunk => chunks.push(chunk))
          })

          msg.once('end', async () => {
            try {
              const fullSource = Buffer.concat(chunks)
              const parsed = await simpleParser(fullSource)
              const email = this.mapParsedToEmail(uid, flags, parsed)
              resolveEmail(email)
            } catch (err) {
              console.error(`Failed to parse email UID ${uid}`, err)
              resolveEmail(null)
            }
          })
        })

        emailPromises.push(promise)
      })

      fetch.once('error', err => {
        reject(err)
      })

      fetch.once('end', async () => {
        const results = await Promise.all(emailPromises)
        resolve(results.filter((e): e is Email => e !== null))
      })
    })
  }

  private mapParsedToEmail(
    uid: number,
    flags: string[],
    parsed: ParsedMail,
  ): Email {
    let categories: EMAIL_CATEGORY[] = []
    const categoryHeader = parsed.headers.get('x-uprent-categories')
    if (categoryHeader) {
      const val = Array.isArray(categoryHeader)
        ? categoryHeader[0]
        : (categoryHeader as string)

      if (typeof val === 'string') {
        categories = val
          .split(',')
          .map(c => c.trim())
          .filter((c): c is EMAIL_CATEGORY =>
            Object.values(EMAIL_CATEGORY).includes(c as EMAIL_CATEGORY),
          )
      }
    }

    const getAddress = (addr: AddressObject | AddressObject[] | undefined) => {
      if (!addr) return []
      const list = Array.isArray(addr) ? addr : [addr]
      return list.flatMap(a => a.value)
    }

    const fromArr = getAddress(parsed.from)
    const toArr = getAddress(parsed.to)
    const ccArr = getAddress(parsed.cc)

    // Map Attachments (Metadata only)
    const attachments: EmailAttachment[] = (parsed.attachments || []).map(
      (att, index) => ({
        uid: index, // simple index as ID
        contentType: att.contentType,
        filename: att.filename,
        size: att.size,
        related: att.related || false,
        contentId: att.contentId,
      }),
    )

    return {
      uid,
      flags,
      categories,
      seen: flags.includes('\\Seen'),
      messageId: parsed.messageId || `no-id-${uid}`,
      subject: parsed.subject || '',
      from: {
        name: fromArr[0]?.name || '',
        email: fromArr[0]?.address || 'unknown@sender.com',
      },
      to: toArr.map(v => ({ name: v.name || '', email: v.address || '' })),
      cc: ccArr.map(v => v.address || ''),
      datetime: (parsed.date || new Date()).toISOString(),
      references:
        typeof parsed.references === 'string'
          ? [parsed.references]
          : parsed.references || [],
      inReplyTo: parsed.inReplyTo,
      attachments,
      content: parsed.html || parsed.textAsHtml || parsed.text || '',
    }
  }

  private async connect(username: string, password: string): Promise<Imap> {
    if (this.connectionPool[username]) {
      this.resetInactivityTimeout(username)
      return this.connectionPool[username]
    }

    const imap = await this.createImap(username, password)
    this.connectionPool[username] = imap
    return imap
  }

  private createImap(username: string, password: string): Promise<Imap> {
    return new Promise<Imap>((resolve, reject) => {
      const imap = new Imap({
        user: username,
        password,
        host: '172.233.33.104',
        port: 993,
        tls: true,
        authTimeout: 10000,
        connTimeout: 10000,
      })
      imap.once('ready', () => resolve(imap))
      imap.once('error', reject)
      imap.connect()
    })
  }

  private resetInactivityTimeout(username: string) {
    if (this.connectionTimeouts[username]) {
      clearTimeout(this.connectionTimeouts[username])
    }

    this.connectionTimeouts[username] = setTimeout(
      () => {
        const imap = this.connectionPool[username]
        if (imap) {
          catchError(imap.end(), false)
        }
        delete this.connectionPool[username]
        delete this.connectionTimeouts[username]
      },
      60 * 60 * 1000,
    )
  }

  private openBox(connection: Imap, boxName: string): Promise<void> {
    return new Promise(resolve => {
      connection.openBox(boxName, false, () => resolve())
    })
  }

  private closeBox(connection: Imap): Promise<void> {
    return new Promise(resolve => {
      connection.closeBox(false, () => resolve())
    })
  }

  private search(connection: Imap, criteria: string[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
      connection.search(criteria, (err, uids) => {
        if (err) return reject(err)
        resolve(uids)
      })
    })
  }
}

export const emailServer = new EmailServer()
