import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { AppError } from '../middleware/error'

export interface CreateUnavailableDateDto {
  roomId: string
  date: string
  startTime?: string
  endTime?: string
  reason?: string
}

export async function addUnavailableDate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, date, startTime, endTime, reason } = req.body as CreateUnavailableDateDto

    if (!roomId || !date) {
      throw new AppError('房间ID和日期不能为空', 400)
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
    const { roomId, startDate, endDate } = req.query

    let list = [...dataStore.unavailableDates]

    if (roomId) {
      list = list.filter(ud => ud.roomId === roomId)
    }
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
    const { id } = req.params

    const index = dataStore.unavailableDates.findIndex(ud => ud.id === id)
    if (index === -1) {
      throw new AppError('记录不存在', 404)
    }

    dataStore.unavailableDates.splice(index, 1)

    res.json({
      code: 200,
      message: '删除成功',
      data: null,
    })
  } catch (error) {
    next(error)
  }
}
