import { SignJWT, jwtVerify } from 'jose'
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const scryptAsync = promisify(scrypt)

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-before-deploy')
}

// ─── Password hashing ────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  const storedBuf = Buffer.from(hash, 'hex')
  const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer
  return timingSafeEqual(storedBuf, derivedBuf)
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: number
  role: string
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret())
  return { userId: payload['userId'] as number, role: payload['role'] as string }
}

// ─── Request helpers ─────────────────────────────────────────────────────────

function getToken(req: VercelRequest): string | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<TokenPayload | null> {
  const token = getToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  try {
    return await verifyToken(token)
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
}
