// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken')
import config from '../config'
import { v4 as uuidv4 } from 'uuid'

export interface JwtPayload {
  userId: string
  role: string
  phone: string
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload as string | object, config.jwtSecret as string, { expiresIn: config.jwtExpiresIn as string })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload
  } catch (error) {
    return null
  }
}

export function generateOrderNo(): string {
  const now = new Date()
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `PR${dateStr}${random}`
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateUuid(): string {
  return uuidv4()
}
