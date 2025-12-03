import { type Email } from '~core/database'

type EmailHeader = Omit<Email, 'content'>

type EmailsState = {
  emailHeaders: Record<number, EmailHeader>
  activeEmailHeader?: EmailHeader
  cachedEmailContents: Record<number, Email>
}

const createEmailsState = () => {
  let state = $state<EmailsState>({
    emailHeaders: {},
    cachedEmailContents: {},
  })

  return {
    set emailHeaders(data: Record<number, EmailHeader>) {
      state.emailHeaders = data
    },
    addHeaders(data: EmailHeader[]) {
      for (const header of data) {
        state.emailHeaders[header.uid] = header
      }
    },
    set activeEmailHeader(data: EmailHeader | undefined) {
      state.activeEmailHeader = data
    },

    set cachedEmailContents(data: Record<number, Email>) {
      state.cachedEmailContents = {
        ...state.cachedEmailContents,
        ...data,
      }
    },
    get activeEmailHeader() {
      return state.activeEmailHeader
    },
    get emailHeaders() {
      return state.emailHeaders
    },
    get cachedEmailContents() {
      return state.cachedEmailContents
    },
  }
}

export const emailsState = createEmailsState()
