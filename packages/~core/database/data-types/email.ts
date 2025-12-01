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
  attachments: EmailAttachment[]
}

export type EmailHeader = Pick<
  Email,
  | 'uid'
  | 'seen'
  | 'categories'
  | 'messageId'
  | 'datetime'
  | 'subject'
  | 'from'
  | 'to'
  | 'cc'
  | 'inReplyTo'
  | 'references'
  | 'flags'
>
