import { type Email } from '~core/database'

type EmailsState = {
  allEmails: Email[]
}

const createEmailsState = () => {
  let state = $state<EmailsState>({
    allEmails: [],
  })

  return {
    get allEmails() {
      return state.allEmails
    },
    set allEmails(data: Email[]) {
      state.allEmails = data
    },
  }
}

export const emailsState = createEmailsState()
