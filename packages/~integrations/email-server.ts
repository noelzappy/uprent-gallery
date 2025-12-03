import Imap from 'imap'
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'
import {
  type Email,
  type EmailAttachment,
  EMAIL_CATEGORY,
} from '~core/database'
import { catchError } from '~utils'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type ConnectionParams = {
  username: string
  password: string
  host: string
  port: number
}

export class EmailServer {
  private connectionPool: Record<string, Imap> = {}
  private connectionTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
  private attachmentsBasePath: string = './storage/attachments'

  async loadEmails(
    connectionParams: ConnectionParams,
    uids: number[],
  ): Promise<Email[]> {
    const { imap, box } = await this.connectAndOpenBox(
      connectionParams,
      'INBOX',
    )

    if (!box.messages.total) {
      return []
    }

    const emails = await this.fetchAndParseEmails(imap, uids)

    return emails
  }

  async getInboxStats(
    connectionParams: ConnectionParams,
  ): Promise<{ total: number; UIDs: number[] }> {
    const { imap, box } = await this.connectAndOpenBox(
      connectionParams,
      'INBOX',
    )

    const total = box.messages.total
    const allUIDs = await this.search(imap, ['ALL'])

    return { total, UIDs: allUIDs }
  }

  async markEmailAsSeen(
    connectionParams: ConnectionParams,
    emailUid: number,
  ): Promise<void> {
    const { imap } = await this.connectAndOpenBox(connectionParams, 'INBOX')

    return new Promise((resolve, reject) => {
      imap.addFlags(emailUid, '\\Seen', err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  async markEmailAsUnseen(
    connectionParams: ConnectionParams,
    emailUid: number,
  ): Promise<void> {
    const { imap } = await this.connectAndOpenBox(connectionParams, 'INBOX')

    return new Promise((resolve, reject) => {
      imap.delFlags(emailUid, '\\Seen', err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  async deleteEmail(
    connectionParams: ConnectionParams,
    emailUid: number,
  ): Promise<void> {
    const { imap } = await this.connectAndOpenBox(connectionParams, 'INBOX')

    return new Promise((resolve, reject) => {
      imap.addFlags(emailUid, '\\Deleted', err => {
        if (err) return reject(err)
        imap.expunge(emailUid, expungeErr => {
          if (expungeErr) return reject(expungeErr)
          resolve()
        })
      })
    })
  }

  private async fetchAndParseEmails(
    imap: Imap,
    uids: number[],
  ): Promise<Email[]> {
    return new Promise<Email[]>((resolve, reject) => {
      const fetch = imap.seq.fetch(uids, {
        bodies: 'HEADER',
        struct: true,
      })

      const emailPromises: Promise<Email | null>[] = []

      fetch.on('message', msg => {
        const promise = new Promise<Email | null>(resolveEmail => {
          let uid = 0
          let flags: string[] = []
          let structure: any = null
          const bodyParts: Record<string, Buffer> = {}

          msg.once('attributes', attrs => {
            uid = attrs.uid
            flags = attrs.flags || []
            structure = attrs.struct
          })

          msg.on('body', (stream, info) => {
            const chunks: Buffer[] = []
            stream.on('data', chunk => chunks.push(chunk))
            stream.once('end', () => {
              bodyParts[info.which] = Buffer.concat(chunks)
            })
          })

          msg.once('end', async () => {
            try {
              const headerBuffer = bodyParts['HEADER'] || Buffer.from('')
              const parsed = await simpleParser(headerBuffer)

              const attachmentMetadata = structure
                ? this.extractAttachmentMetadata(structure)
                : []

              const email = this.mapParsedToEmail(
                uid,
                flags,
                parsed,
                attachmentMetadata,
              )
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

  private extractAttachmentMetadata(
    struct: any,
    partNumber: string = '',
  ): EmailAttachment[] {
    const attachments: EmailAttachment[] = []
    let index = 0

    const traverse = (part: any, currentPartNum: string) => {
      if (Array.isArray(part)) {
        part.forEach((subPart, idx) => {
          const subPartNum = currentPartNum
            ? `${currentPartNum}.${idx + 1}`
            : `${idx + 1}`
          traverse(subPart, subPartNum)
        })
      } else if (part) {
        const disposition = part.disposition
        const isAttachment =
          disposition?.type?.toLowerCase() === 'attachment' ||
          (disposition?.type?.toLowerCase() === 'inline' &&
            part.type !== 'text')

        if (isAttachment && currentPartNum) {
          const params = disposition?.params || {}
          const filename =
            params.filename || part.params?.name || `attachment-${index}`

          attachments.push({
            uid: index++,
            contentType: `${part.type}/${part.subtype}`.toLowerCase(),
            filename,
            size: part.size || 0,
            related: disposition?.type?.toLowerCase() === 'inline',
            contentId: part.id,
            partNumber: currentPartNum,
          })
        }

        // Recurse into multipart parts
        if (part.type === 'multipart' && Array.isArray(part.parts)) {
          part.parts.forEach((subPart: any, idx: number) => {
            const subPartNum = currentPartNum
              ? `${currentPartNum}.${idx + 1}`
              : `${idx + 1}`
            traverse(subPart, subPartNum)
          })
        }
      }
    }

    traverse(struct, partNumber)
    return attachments
  }

  async fetchEmailBody({
    connectionParams,
    emailUid,
  }: {
    connectionParams: ConnectionParams
    emailUid: number
  }): Promise<string> {
    const { imap } = await this.connectAndOpenBox(connectionParams, 'INBOX')

    try {
      return await new Promise<string>((resolve, reject) => {
        const fetch = imap.fetch([emailUid], {
          bodies: ['TEXT'],
          struct: false,
        })

        const chunks: Buffer[] = []

        fetch.on('message', msg => {
          msg.on('body', stream => {
            stream.on('data', chunk => chunks.push(chunk))
          })

          msg.once('end', async () => {
            try {
              const textBuffer = Buffer.concat(chunks)
              const parsed = await simpleParser(textBuffer)
              const content =
                parsed.html || parsed.textAsHtml || parsed.text || ''
              resolve(content)
            } catch (err) {
              reject(err)
            }
          })
        })

        fetch.once('error', reject)
      })
    } finally {
      await catchError(this.closeBox(imap), false)
      this.resetInactivityTimeout(connectionParams.username)
    }
  }

  async fetchAttachment({
    connectionParams,
    emailUid,
    partNumber,
    saveToDisk = true,
  }: {
    connectionParams: ConnectionParams
    emailUid: number
    partNumber: string
    saveToDisk?: boolean
  }): Promise<{ content: Buffer; path?: string }> {
    const { imap } = await this.connectAndOpenBox(connectionParams, 'INBOX')

    try {
      return await new Promise<{ content: Buffer; path?: string }>(
        (resolve, reject) => {
          const fetch = imap.fetch([emailUid], {
            bodies: [`${partNumber}`],
            struct: false,
          })

          const chunks: Buffer[] = []

          fetch.on('message', msg => {
            msg.on('body', stream => {
              stream.on('data', chunk => chunks.push(chunk))
            })

            msg.once('end', async () => {
              try {
                const content = Buffer.concat(chunks)

                if (saveToDisk) {
                  const emailDir = join(
                    this.attachmentsBasePath,
                    emailUid.toString(),
                  )
                  await mkdir(emailDir, { recursive: true })

                  const filename = `part-${partNumber.replace(/\./g, '-')}`
                  const filePath = join(emailDir, filename)

                  await writeFile(filePath, content)
                  resolve({ content, path: filePath })
                } else {
                  resolve({ content })
                }
              } catch (err) {
                reject(err)
              }
            })
          })

          fetch.once('error', reject)
        },
      )
    } finally {
      await catchError(this.closeBox(imap), false)
    }
  }

  async fetchAndSaveAttachment({
    connectionParams,
    emailUid,
    attachment,
  }: {
    connectionParams: ConnectionParams
    emailUid: number
    attachment: EmailAttachment
  }): Promise<string> {
    if (!attachment.partNumber) {
      throw new Error('Attachment must have partNumber for lazy-loading')
    }

    if (attachment.path) {
      return attachment.path
    }

    const { content } = await this.fetchAttachment({
      connectionParams,
      emailUid,
      partNumber: attachment.partNumber,
      saveToDisk: false,
    })

    const emailDir = join(this.attachmentsBasePath, emailUid.toString())
    await mkdir(emailDir, { recursive: true })

    const filename = attachment.filename || `attachment-${attachment.uid}`
    const filePath = join(emailDir, filename)

    await writeFile(filePath, content)
    return filePath
  }

  private mapParsedToEmail(
    uid: number,
    flags: string[],
    parsed: ParsedMail,
    attachments: EmailAttachment[],
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
      content: '',
    }
  }

  private async connect(params: ConnectionParams): Promise<Imap> {
    if (
      this.connectionPool[params.username] &&
      this.connectionPool[params.username].state === 'authenticated'
    ) {
      this.resetInactivityTimeout(params.username)
      return this.connectionPool[params.username]
    }

    const imap = await this.createImap(params)
    this.connectionPool[params.username] = imap
    return imap
  }

  private createImap(params: ConnectionParams): Promise<Imap> {
    return new Promise<Imap>((resolve, reject) => {
      const imap = new Imap({
        user: params.username,
        password: params.password,
        host: params.host,
        port: params.port,
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

  private connectAndOpenBox(
    params: ConnectionParams,
    boxName: string,
  ): Promise<{ imap: Imap; box: Imap.Box }> {
    return new Promise<{ imap: Imap; box: Imap.Box }>(
      async (resolve, reject) => {
        try {
          const imap = await this.connect(params)
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

  private openBox(connection: Imap, boxName: string): Promise<Imap.Box> {
    return new Promise(resolve => {
      connection.openBox(boxName, false, (err, box) => {
        if (err) throw err
        resolve(box)
      })
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
