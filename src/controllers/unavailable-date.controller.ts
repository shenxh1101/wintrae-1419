import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { AppError } from '../middleware/error'

export interface CreateUnavailableDateDto {
  date: string
  startTime?: string
  endTime?: string
  reason?: string
}

export async function addUnavailableDate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId } = req.params
    const { date, startTime, endTime, reason } = req.body as CreateUnavailableDateDto

    if (!roomId || !date) {
      throw new AppError('房间ID和日期不能为空', 400)
    }

    const room = dataStore.rooms.find(r => r.id === roomId)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    const existing = dataStore.unavailableDates.find(
      ud => ud.roomId === roomId && ud.date === date && ud.startTime === startTime && ud.endTime === endTime
    )
    if (existing) {
      throw new AppError('该时段已设置为不可预约', 400)
    }

    const unavailableDate = dataStore.addUnavailableDate({
      roomId,
      date,
      startTime,
      endTime,
      reason,
    })

    res.status(201).json({
      code: 200,
      message: '添加成功',
      data: unavailableDate,
    })
  } catch (error) {
    next(error)
  }
}

export async function getUnavailableDates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId } = req.params
    const { startDate, endDate } = req.query

    let list = dataStore.unavailableDates.filter(ud => ud.roomId === roomId)

    if (startDate) {
      list = list.filter(ud => ud.date >= startDate)
    }
    if (endDate) {
      list = list.filter(ud => ud.date <= endDate)
    }

    list.sort((a, b) => a.date.localeCompare(b.date))

    res.json({
      code: 200,
      message: '获取成功',
      data: list,
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteUnavailableDate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, id } = req.params

    const record = dataStore.unavailableDates.find(ud => ud.id === id)
    if (!record) {
      throw new AppError('记录不存在', 404)
    }

    if (record.roomId !== roomId) {
      throw new AppError('该记录不属于当前房间，无权删除', 403)
    }

    const index = dataStore.unavailableDates.indexOf(record)
    dataStore.unavailableDates.splice(index, 1)
    dataStore.markUpdated()

    res.json({
      code: 200,
      message: '删除成功',
      data: null,
    })
  } catch (error) {
    next(error)
  }
}
