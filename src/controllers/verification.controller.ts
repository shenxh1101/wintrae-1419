import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { BookingStatus } from '../entities/Booking'
import { AppError } from '../middleware/error'
import { AuthRequest } from '../middleware/auth'
import dayjs from 'dayjs'

export async function checkIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bookingId, verificationCode } = req.body

    if (!bookingId || !verificationCode) {
      throw new AppError('预约ID和核销码不能为空', 400)
    }

    const booking = dataStore.bookings.find(b => b.id === bookingId)
    if (!booking) {
      throw new AppError('预约不存在', 404)
    }

    if (booking.verificationCode !== verificationCode) {
      throw new AppError('核销码错误', 400)
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppError('该预约状态不能核销', 400)
    }

    const now = dayjs()
    const bookingStart = dayjs(`${booking.bookingDate} ${booking.startTime}`)
    const diffMinutes = now.diff(bookingStart, 'minute')

    if (diffMinutes < -15) {
      throw new AppError('还未到预约开始前15分钟，暂不能核销', 400)
    }

    booking.status = BookingStatus.CHECKED_IN
    booking.checkInTime = new Date()
    booking.updatedAt = new Date()

    res.json({
      code: 200,
      message: '核销成功',
      data: booking,
    })
  } catch (error) {
    next(error)
  }
}

export async function checkOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bookingId } = req.body

    if (!bookingId) {
      throw new AppError('预约ID不能为空', 400)
    }

    const booking = dataStore.bookings.find(b => b.id === bookingId)
    if (!booking) {
      throw new AppError('预约不存在', 404)
    }

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new AppError('该预约状态不能退房', 400)
    }

    booking.status = BookingStatus.COMPLETED
    booking.checkOutTime = new Date()
    booking.updatedAt = new Date()

    res.json({
      code: 200,
      message: '退房成功',
      data: booking,
    })
  } catch (error) {
    next(error)
  }
}

export async function getOvertimeBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const now = dayjs()
    const today = now.format('YYYY-MM-DD')
    const currentTime = now.format('HH:mm')

    const list = dataStore.bookings.filter(booking => {
      if (booking.bookingDate !== today) return false
      if (booking.endTime >= currentTime) return false
      if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.CHECKED_IN) return false
      return true
    })

    const result = list.map(booking => {
      const endTime = dayjs(`${booking.bookingDate} ${booking.endTime}`)
      const overtimeMinutes = now.diff(endTime, 'minute')
      const room = dataStore.rooms.find(r => r.id === booking.roomId)
      const user = dataStore.users.find(u => u.id === booking.userId)
      return {
        ...booking,
        room,
        user: user ? { id: user.id, phone: user.phone, nickname: user.nickname } : undefined,
        overtimeMinutes,
      }
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

export async function getUpcomingReminders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const now = dayjs()
    const today = now.format('YYYY-MM-DD')

    const bookings = dataStore.bookings.filter(booking => {
      if (booking.userId !== userId) return false
      if (booking.bookingDate !== today) return false
      if (booking.status !== BookingStatus.CONFIRMED) return false
      if (booking.reminderSent) return false

      const startTime = dayjs(`${booking.bookingDate} ${booking.startTime}`)
      const diff = startTime.diff(now, 'minute')
      return diff > 0 && diff <= 15
    })

    const result = bookings.map(booking => {
      const room = dataStore.rooms.find(r => r.id === booking.roomId)
      return { ...booking, room }
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
