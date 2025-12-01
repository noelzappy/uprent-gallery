import Imap from 'imap'
import {
  simpleParser,
  type ParsedMail,
  type AddressObject,
  type Source,
} from 'mailparser'
import {
  type Email,
  type EmailAttachment,
  EMAIL_CATEGORY,
} from '~core/database'
import type {
  EmailHeader,
  EmailHeaderCursorResponse,
} from '~core/database/data-types/email'
import { catchError } from '~utils'

export class EmailServer {
  private connectionPool: Record<string, Imap> = {}
  private connectionTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}

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
  }): Promise<EmailHeaderCursorResponse> {
    const { imap, box } = await this.connectAndOpenBox(
      username,
      password,
      'INBOX',
    )

    if (!box.messages.total) {
      return {
        emailHeaders: [],
        paging: {
          pageSize: 0,
          cursor: 0,
          hasMore: false,
        },
      }
    }

    try {
      const pagination = this.constructPagination(box, cursor, limit)

      const emailHeaders = await this.fetchEmailHeadersOnly(imap, pagination)

      return {
        emailHeaders,
        paging: {
          cursor: pagination.nextCursor,
          hasMore: pagination.hasMore,
          pageSize: pagination.pageSize,
        },
      }
    } finally {
      await catchError(this.closeBox(imap), false)
    }
  }

  private constructPagination(
    box: Imap.Box,
    cursor: number = 0,
    limit: number = 10,
  ) {
    const totalEmails = box.messages.total
    const end = totalEmails - cursor
    const start = Math.max(1, end - limit + 1)

    const willHaveMoreAfterThisPage = start > 1
    const nextCursor = cursor + (end - start + 1)

    return {
      start,
      end,
      hasMore: willHaveMoreAfterThisPage,
      nextCursor,
      pageSize: limit,
    }
  }

  private connectAndOpenBox(
    username: string,
    password: string,
    boxName: string,
  ): Promise<{ imap: Imap; box: Imap.Box }> {
    return new Promise<{ imap: Imap; box: Imap.Box }>(
      async (resolve, reject) => {
        try {
          const imap = await this.connect(username, password)
          const box = await this.openBox(imap, boxName)
          resolve({
            imap,
            box,
          })
        } catch (err) {
          reject(err)
        }
      },
    )
  }

  private async fetchEmailHeadersOnly(
    imap: Imap,
    pagination: { start: number; end: number },
  ): Promise<EmailHeader[]> {
    return new Promise<EmailHeader[]>((resolve, reject) => {
      const fetch = imap.fetch(`${pagination.start}:${pagination.end}`, {
        bodies: 'HEADER.FIELDS (FROM TO UID SUBJECT DATE MESSAGE-ID)',
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

  async fetchSingleEmail(
    username: string,
    password: string,
    uid: number,
  ): Promise<Email> {
    const { imap } = await this.connectAndOpenBox(username, password, 'INBOX')

    return new Promise<Email>((resolve, reject) => {
      const fetch = imap.fetch(uid, {
        bodies: '',
        struct: true,
      })

      let parsed: ParsedMail | null = null
      let flags: string[] = []
      let attrs: Imap.ImapMessageAttributes | null = null

      fetch.on('message', msg => {
        msg.on('body', (stream: NodeJS.ReadableStream) => {
          simpleParser(stream as Source)
            .then(mail => {
              parsed = mail
            })
            .catch(err => {
              reject(err)
            })
        })

        msg.once('attributes', a => {
          attrs = a
          flags = a.flags || []
        })
      })

      fetch.once('error', err => {
        reject(err)
      })

      fetch.once('end', () => {
        if (!parsed || !attrs) {
          return reject(new Error(`Email with UID ${uid} not found`))
        }

        try {
          const email = this.mapParsedToEmail(uid, flags, parsed)
          resolve(email)
        } catch (err) {
          reject(err)
        } finally {
          catchError(this.closeBox(imap), false)
        }
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

  private openBox(connection: Imap, boxName: string): Promise<Imap.Box> {
    return new Promise((resolve, reject) => {
      connection.openBox(boxName, false, (err, box) => {
        if (err) {
          return reject(err)
        }

        resolve(box)
      })
    })
  }

  private closeBox(connection: Imap): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.closeBox(false, err => {
        if (err) return reject(err)
        resolve()
      })
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
