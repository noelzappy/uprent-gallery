export interface EmailAttachment {
  uid: number
  contentType: string
  filename?: string | undefined
  size: number
  contentId?: string | undefined
  /**
   * If true then this attachment should not be offered for download
   * (at least not in the main attachments list).
   */
  related?: boolean | undefined
  path?: string | undefined
  partNumber?: string | undefined
}

export enum EMAIL_CATEGORY {
  RequestConfirmation = 'request_confirmation',
  AutomatedDataRequest = 'automated_data_request',
  ManualDataRequest = 'manual_data_request',
  ViewingInvitation = 'viewing_invitation',
  PropertyRented = 'property_unavailable_rented',
  GeneralRejection = 'general_rejection',
  SignupConfirmation = 'signup_confirmation',
  Promotion = 'promotion',
  Other = 'other',
  Uprent = 'uprent',
}

export interface EmailCursorResponse {
  emails: Email[]
  paging: {
    hasMore: boolean
    cursor: number
    pageSize: number
  }
}

export interface ImapAccount {
  id: number
  email_address: string
  imap_host: string
  imap_port: number
  username: string
  password: string
}

export interface Email {
  uid: number
  seen: boolean
  categories?: EMAIL_CATEGORY[]
  messageId: string
  datetime: string
  subject: string
  content: string
  from: {
    name?: string | undefined
    email: string
  }
  to: {
    name?: string | undefined
    email: string
  }[]
  cc?: string[]
  inReplyTo?: string
  references?: string[]
  flags: string[]
  attachments?: EmailAttachment[]
}
export interface EmailDBRecord {
  id: number
  emailAccountId: number
  emailAddress: string
  mailbox: string
  imapUid: number
  categoriesJson?: string
  messageId?: string
  subject?: string
  fromName?: string
  fromEmail?: string
  toJson?: string
  ccJson?: string
  date?: string
  flagsJson?: string
  snippet?: string
  bodyPlain?: string
  bodyHtml?: string
  inReplyTo?: string
  refs?: string
  attachmentJson?: string
  size?: number
  hasAttachments: number
  createdAt: string
  updatedAt: string
}

export interface EmailAttachmentDBRecord {
  id: number
  emailId: number
  partId: string
  filename?: string
  mimeType?: string
  size?: number
  storagePath?: string
  createdAt: string
}
