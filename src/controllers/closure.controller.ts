import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { ClosureType, ClosureStatus } from '../entities/TemporaryClosure'
import { AppError } from '../middleware/error'
import { AuthRequest } from '../middleware/auth'

export interface CreateClosureDto {
  roomId: string
  type: ClosureType
  startDate: string
  endDate: string
  startTime?: string
  endTime?: string
  reason?: string
}

export async function createClosure(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, type, startDate, endDate, startTime, endTime, reason } = req.body as CreateClosureDto

    if (!roomId || !type || !startDate || !endDate) {
      throw new AppError('请填写完整的闭店信息', 400)
    }

    if (type === ClosureType.PARTIAL && (!startTime || !endTime)) {
      throw new AppError('部分闭店需要指定开始和结束时间', 400)
    }

    const closure = dataStore.addClosure({
      roomId,
      type,
      startDate,
      endDate,
      startTime,
      endTime,
      reason,
      status: ClosureStatus.ACTIVE,
    })

    res.status(201).json({
      code: 200,
      message: '创建成功',
      data: closure,
    })
  } catch (error) {
    next(error)
  }
}

export async function getClosures(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, startDate, endDate, status } = req.query

    let list = [...dataStore.closures]

    if (roomId) {
      list = list.filter(c => c.roomId === roomId)
    }
    if (startDate) {
      list = list.filter(c => c.endDate >= startDate)
    }
    if (endDate) {
      list = list.filter(c => c.startDate <= endDate)
    }
    if (status) {
      list = list.filter(c => c.status === status)
    }

    list.sort((a, b) => b.startDate.localeCompare(a.startDate))

    const result = list.map(closure => {
      const room = dataStore.rooms.find(r => r.id === closure.roomId)
      return { ...closure, room }
    })

    res.json({
      code: 200,
      message: '获取成功',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

export async function cancelClosure(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    const closure = dataStore.closures.find(c => c.id === id)
    if (!closure) {
      throw new AppError('闭店记录不存在', 404)
    }

    closure.status = ClosureStatus.CANCELLED
    closure.updatedAt = new Date()
    dataStore.markUpdated()

    res.json({
      code: 200,
      message: '取消成功',
      data: closure,
    })
  } catch (error) {
    next(error)
  }
}
