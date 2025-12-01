import { type Email, type EmailHeader } from '~core/database'

type EmailsState = {
  emailHeaders: EmailHeader[]
  activeEmailHeader?: EmailHeader
  cachedEmailContents: Record<number, Email>
}

const createEmailsState = () => {
  let state = $state<EmailsState>({
    emailHeaders: [],
    cachedEmailContents: {},
  })

  return {
    set emailHeaders(data: EmailHeader[]) {
      const merged = [...state.emailHeaders, ...data]
      const uniqueHeadersMap = new Map<number, EmailHeader>()
      for (const header of merged) {
        uniqueHeadersMap.set(header.uid, header)
      }

      const sortedHeaders = Array.from(uniqueHeadersMap.values())
      sortedHeaders.sort((a, b) => {
        return new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      })

      state.emailHeaders = sortedHeaders
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
