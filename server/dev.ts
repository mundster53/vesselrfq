import express, { type Request, type Response } from 'express'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import registerHandler from '../api/auth/register'
import loginHandler from '../api/auth/login'
import meHandler from '../api/auth/me'
import rfqsHandler from '../api/rfqs/index'

const app = express()
app.use(express.json())

function wrap(handler: (req: VercelRequest, res: VercelResponse) => unknown) {
  return (req: Request, res: Response) => handler(req as unknown as VercelRequest, res as unknown as VercelResponse)
}

app.all('/api/auth/register', wrap(registerHandler))
app.all('/api/auth/login', wrap(loginHandler))
app.all('/api/auth/me', wrap(meHandler))
app.all('/api/rfqs', wrap(rfqsHandler))

const PORT = 3001
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`))
