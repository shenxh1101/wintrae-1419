import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { BookingStatus } from '../entities/Booking'
import { AppError } from '../middleware/error'
import { AuthRequest } from '../middleware/auth'
import { isTimeSlotAvailable, calculatePrice, getAvailableTimeSlots } from '../services/booking.service'
import dayjs from 'dayjs'

export interface CreateBookingDto {
  roomId: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: number
  peopleCount: number
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export async function createBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const { roomId, bookingDate, startTime, endTime, duration, peopleCount } = req.body as CreateBookingDto

    if (!roomId || !bookingDate || !startTime || !endTime || !duration) {
      throw new AppError('请填写完整的预约信息', 400)
    }

    if (dayjs(bookingDate).isBefore(dayjs().startOf('day'))) {
      throw new AppError('不能预约过去的日期', 400)
    }

    if (dayjs(bookingDate).isSame(dayjs(), 'day')) {
      const now = dayjs()
      const [hours, minutes] = startTime.split(':').map(Number)
      const startDateTime = dayjs(bookingDate).hour(hours).minute(minutes)
      if (startDateTime.isBefore(now)) {
        throw new AppError('不能预约过去的时间', 400)
      }
    }

    const room = dataStore.rooms.find(r => r.id === roomId && r.isActive)
    if (!room) {
      throw new AppError('琴房不存在或已停用', 404)
    }

    if (peopleCount > room.capacity) {
      throw new AppError(`该琴房最多容纳${room.capacity}人`, 400)
    }

    const available = await isTimeSlotAvailable(roomId, bookingDate, startTime, endTime)
    if (!available) {
      throw new AppError('该时段已被预约或不可用', 400)
    }

    const totalAmount = calculatePrice(room.pricePerHour, duration)

    const booking = dataStore.addBooking({
      userId: userId!,
      roomId,
      bookingDate,
      startTime,
      endTime,
      duration,
      peopleCount: peopleCount || 1,
      status: BookingStatus.CONFIRMED,
      totalAmount,
      paidAmount: totalAmount,
      reminderSent: false,
      overtimeReminderSent: false,
    })

    const roomInfo = dataStore.rooms.find(r => r.id === roomId)
    const result = { ...booking, room: roomInfo }

    res.status(201).json({
      code: 200,
      message: '预约成功',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

export async function cancelBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const { id } = req.params
    const { reason } = req.body

    const booking = dataStore.bookings.find(b => b.id === id)
    if (!booking) {
      throw new AppError('预约不存在', 404)
    }

    if (booking.userId !== userId && req.user?.role !== 'admin') {
      throw new AppError('无权限操作该预约', 403)
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError('该预约已取消', 400)
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new AppError('已完成的预约不能取消', 400)
    }

    booking.status = BookingStatus.CANCELLED
    booking.cancelledAt = new Date()
    booking.cancelReason = reason
    booking.updatedAt = new Date()

    res.json({
      code: 200,
      message: '取消成功',
      data: booking,
    })
  } catch (error) {
    next(error)
  }
}

export async function extendBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const { id } = req.params
    const { extendDuration } = req.body

    if (!extendDuration || extendDuration <= 0) {
      throw new AppError('请输入有效的续时时长', 400)
    }

    const booking = dataStore.bookings.find(b => b.id === id)
    if (!booking) {
      throw new AppError('预约不存在', 404)
    }

    if (booking.userId !== userId) {
      throw new AppError('无权限操作该预约', 403)
    }

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.CHECKED_IN) {
      throw new AppError('该状态下的预约不能续时', 400)
    }

    const room = dataStore.rooms.find(r => r.id === booking.roomId)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    const currentEndMinutes = timeToMinutes(booking.endTime)
    const newEndMinutes = currentEndMinutes + extendDuration
    const newEndTime = minutesToTime(newEndMinutes)

    const closingMinutes = timeToMinutes(room.closingTime)
    if (newEndMinutes > closingMinutes) {
      throw new AppError('续时后超出营业时间', 400)
    }

    const available = await isTimeSlotAvailable(
      booking.roomId,
      booking.bookingDate,
      booking.endTime,
      newEndTime,
      booking.id
    )
    if (!available) {
      throw new AppError('该时段已被预约，无法续时', 400)
    }

    const extendPrice = calculatePrice(room.pricePerHour, extendDuration)

    booking.endTime = newEndTime
    booking.duration += extendDuration
    booking.totalAmount = Math.round((booking.totalAmount + extendPrice) * 100) / 100
    booking.paidAmount = Math.round((booking.paidAmount + extendPrice) * 100) / 100
    booking.updatedAt = new Date()

    res.json({
      code: 200,
      message: '续时成功',
      data: {
        booking,
        extendPrice,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getBookingById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const { id } = req.params

    const booking = dataStore.bookings.find(b => b.id === id)
    if (!booking) {
      throw new AppError('预约不存在', 404)
    }

    if (booking.userId !== userId && req.user?.role !== 'admin') {
      throw new AppError('无权限查看该预约', 403)
    }

    const room = dataStore.rooms.find(r => r.id === booking.roomId)
    const result = { ...booking, room }

    res.json({
      code: 200,
      message: '获取成功',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

export async function getMyBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const { page = 1, pageSize = 10, status } = req.query

    let bookings = dataStore.bookings.filter(b => b.userId === userId)

    if (status) {
      bookings = bookings.filter(b => b.status === status)
    }

    bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const total = bookings.length
    const skip = (Number(page) - 1) * Number(pageSize)
    const list = bookings.slice(skip, skip + Number(pageSize))

    const result = list.map(booking => {
      const room = dataStore.rooms.find(r => r.id === booking.roomId)
      return { ...booking, room }
    })

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        list: result,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function checkAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, date, duration = 30 } = req.query

    if (!roomId || !date) {
      throw new AppError('房间ID和日期不能为空', 400)
    }

    const timeSlots = await getAvailableTimeSlots(
      roomId as string,
      date as string,
      Number(duration)
    )

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        roomId,
        date,
        timeSlots,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function calculateFee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, duration } = req.query

    if (!roomId || !duration) {
      throw new AppError('房间ID和时长不能为空', 400)
    }

    const room = dataStore.rooms.find(r => r.id === roomId as string)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    const totalAmount = calculatePrice(room.pricePerHour, Number(duration))

    res.json({
      code: 200,
      message: '计算成功',
      data: {
        roomId,
        duration: Number(duration),
        pricePerHour: room.pricePerHour,
        totalAmount,
      },
    })
  } catch (error) {
    next(error)
  }
}
