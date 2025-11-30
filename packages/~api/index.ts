import { treaty } from '@elysiajs/eden'
import type { App } from '@/app'

const api = treaty<App>('http://localhost:5002')

export default api
