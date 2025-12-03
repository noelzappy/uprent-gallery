import { treaty } from '@elysiajs/eden'
import type { App } from '@/app'

export const API_URL = 'http://localhost:5002'
const api = treaty<App>(API_URL)

export default api
