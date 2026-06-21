import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/auth'
import { UserRole } from '../entities/User'

export interface AuthRequest extends Request {
  user?: {
    userId: string
    role: string
    phone: string
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: '未授权，请先登录', data: null })
    return
  }

  const token = authHeader.slice(7)
  const payload = verifyToken(token)

  if (!payload) {
    res.status(401).json({ code: 401, message: 'Token 无效或已过期', data: null })
    return
  }

  req.user = payload
  next()
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    res.status(403).json({ code: 403, message: '无权限访问，需要管理员权限', data: null })
    return
  }
  next()
}

export function roleMiddleware(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ code: 403, message: '无权限访问', data: null })
      return
    }
    next()
  }
}
