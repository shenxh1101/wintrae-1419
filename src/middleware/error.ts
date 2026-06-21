import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  public statusCode: number
  public code: number

  constructor(message: string, statusCode: number = 400, code?: number) {
    super(message)
    this.statusCode = statusCode
    this.code = code || statusCode
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err.message)

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      data: null,
    })
    return
  }

  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null,
  })
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 404,
    message: '接口不存在',
    data: null,
  })
}
