import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { UserRole, User } from '../entities/User'
import { generateToken } from '../utils/auth'
import { AppError } from '../middleware/error'
import { AuthRequest } from '../middleware/auth'
import * as bcrypt from 'bcryptjs'

export interface RegisterDto {
  phone: string
  password: string
  nickname?: string
  email?: string
}

export interface LoginDto {
  phone: string
  password: string
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, password, nickname, email } = req.body as RegisterDto

    if (!phone || !password) {
      throw new AppError('手机号和密码不能为空', 400)
    }

    if (password.length < 6) {
      throw new AppError('密码长度不能少于6位', 400)
    }

    const existingUser = dataStore.users.find(u => u.phone === phone)
    if (existingUser) {
      throw new AppError('该手机号已注册', 400)
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = dataStore.addUser({
      phone,
      password: hashedPassword,
      nickname: nickname || `用户${phone.slice(-4)}`,
      email,
      role: UserRole.USER,
      isActive: true,
    })

    const token = generateToken({
      userId: user.id,
      role: user.role,
      phone: user.phone,
    })

    res.status(201).json({
      code: 200,
      message: '注册成功',
      data: {
        token,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          email: user.email,
          role: user.role,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phone, password } = req.body as LoginDto

    if (!phone || !password) {
      throw new AppError('手机号和密码不能为空', 400)
    }

    const user = dataStore.users.find(u => u.phone === phone && u.isActive)
    if (!user) {
      throw new AppError('用户不存在或已被禁用', 401)
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      throw new AppError('密码错误', 401)
    }

    const token = generateToken({
      userId: user.id,
      role: user.role,
      phone: user.phone,
    })

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          email: user.email,
          role: user.role,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId

    const user = dataStore.users.find(u => u.id === userId)
    if (!user) {
      throw new AppError('用户不存在', 404)
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const { nickname, email } = req.body

    const user = dataStore.users.find(u => u.id === userId)
    if (!user) {
      throw new AppError('用户不存在', 404)
    }

    if (nickname !== undefined) user.nickname = nickname
    if (email !== undefined) user.email = email
    user.updatedAt = new Date()

    res.json({
      code: 200,
      message: '更新成功',
      data: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    next(error)
  }
}
