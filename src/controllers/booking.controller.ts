import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { BookingStatus, RefundStatus, DeductionType } from '../entities/Booking'
import { MemberLevel } from '../entities/MemberLevel'
import { UserRole } from '../entities/User'
import { AppError } from '../middleware/error'
import { AuthRequest } from '../middleware/auth'
import {
  isTimeSlotAvailable,
  calculatePrice,
  getAvailableTimeSlots,
  validateTimeRange,
  calculateFeeDetail,
  getConflictCalendar,
  getMultiRoomConflictCalendar,
  calculateRefund,
  calculateBookingStats,
  RefundCalculation,
} from '../services/booking.service'
import dayjs from 'dayjs'

export interface CreateBookingDto {
  roomId: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: number
  peopleCount: number
  couponCode?: string
  deductionType?: 'none' | 'balance' | 'times_card'
  timesCardId?: string
}

export interface RescheduleBookingDto {
  bookingDate?: string
  startTime?: string
  endTime?: string
  duration?: number
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
    const {
      roomId,
      bookingDate,
      startTime,
      endTime,
      duration,
      peopleCount,
      couponCode,
      deductionType = DeductionType.NONE,
      timesCardId,
    } = req.body as CreateBookingDto

    if (!roomId || !bookingDate || !startTime || !endTime || !duration) {
      throw new AppError('请填写完整的预约信息', 400)
    }

    const timeValidation = validateTimeRange(startTime, endTime, duration)
    if (!timeValidation.valid) {
      throw new AppError(timeValidation.reason!, 400)
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

    const availability = await isTimeSlotAvailable(roomId, bookingDate, startTime, endTime)
    if (!availability.available) {
      throw new AppError(`该时段不可用：${availability.reason}`, 400)
    }

    const user = dataStore.users.find(u => u.id === userId)
    const memberLevel = user?.memberLevel || MemberLevel.NORMAL
    const feeDetail = calculateFeeDetail(
      room.pricePerHour,
      duration,
      memberLevel,
      couponCode,
      deductionType as DeductionType,
      timesCardId,
      userId
    )

    if (feeDetail.deductionType !== DeductionType.NONE && feeDetail.deductionError) {
      throw new AppError(feeDetail.deductionError, 400)
    }

    if (feeDetail.deductionType === DeductionType.BALANCE) {
      dataStore.consumeWallet(userId!, feeDetail.deductionAmount)
    } else if (feeDetail.deductionType === DeductionType.TIMES_CARD && feeDetail.timesCardId) {
      dataStore.consumeTimesCard(feeDetail.timesCardId, 1)
    }

    if (feeDetail.couponId) {
      const coupon = dataStore.coupons.find(c => c.id === feeDetail.couponId)
      if (coupon) {
        coupon.usedCount++
      }
    }

    const booking = dataStore.addBooking({
      userId: userId!,
      roomId,
      bookingDate,
      startTime,
      endTime,
      duration,
      peopleCount: peopleCount || 1,
      status: BookingStatus.CONFIRMED,
      originalAmount: feeDetail.originalAmount,
      memberDiscountAmount: feeDetail.memberDiscountAmount,
      couponDiscountAmount: feeDetail.couponDiscountAmount,
      totalAmount: feeDetail.totalAmount,
      paidAmount: feeDetail.finalPayAmount,
      deductionType: feeDetail.deductionType,
      deductionAmount: feeDetail.deductionAmount,
      timesCardId: feeDetail.timesCardId,
      timesCardConsumed: feeDetail.deductionType === DeductionType.TIMES_CARD ? 1 : 0,
      refundStatus: RefundStatus.NONE,
      refundAmount: 0,
      memberLevel,
      couponId: feeDetail.couponId,
      couponCode: feeDetail.couponCode,
      reminderSent: false,
      overtimeReminderSent: false,
    })

    dataStore.markUpdated()

    const roomInfo = dataStore.rooms.find(r => r.id === roomId)
    const result = {
      ...booking,
      room: roomInfo,
      wallet: feeDetail.deductionType === DeductionType.BALANCE
        ? { balanceBefore: feeDetail.balanceBefore, balanceAfter: feeDetail.balanceAfter }
        : undefined,
      timesCard: feeDetail.deductionType === DeductionType.TIMES_CARD
        ? { cardId: feeDetail.timesCardId, cardName: feeDetail.timesCardName, remaining: feeDetail.timesCardRemaining }
        : undefined,
    }

    res.status(201).json({
      code: 200,
      message: '预约成功',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

export async function rescheduleBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId
    const { id } = req.params
    const { bookingDate, startTime, endTime, duration } = req.body as RescheduleBookingDto

    const booking = dataStore.bookings.find(b => b.id === id)
    if (!booking) {
      throw new AppError('预约不存在', 404)
    }

    if (booking.userId !== userId && req.user?.role !== 'admin') {
      throw new AppError('无权限操作该预约', 403)
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppError('该状态下的预约不能改期', 400)
    }

    const newBookingDate = bookingDate || booking.bookingDate
    const newStartTime = startTime || booking.startTime
    const newEndTime = endTime || booking.endTime
    const newDuration = duration || booking.duration

    const timeValidation = validateTimeRange(newStartTime, newEndTime, newDuration)
    if (!timeValidation.valid) {
      throw new AppError(timeValidation.reason!, 400)
    }

    if (dayjs(newBookingDate).isBefore(dayjs().startOf('day'))) {
      throw new AppError('不能改期到过去的日期', 400)
    }

    const room = dataStore.rooms.find(r => r.id === booking.roomId)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    const availability = await isTimeSlotAvailable(booking.roomId, newBookingDate, newStartTime, newEndTime, booking.id)
    if (!availability.available) {
      throw new AppError(`该时段不可用：${availability.reason}`, 400)
    }

    const originalBooking = {
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      duration: booking.duration,
    }

    const originalAmount = calculatePrice(room.pricePerHour, newDuration)
    const memberLevel = (booking.memberLevel as MemberLevel) || MemberLevel.NORMAL
    const feeDetail = calculateFeeDetail(room.pricePerHour, newDuration, memberLevel)

    booking.bookingDate = newBookingDate
    booking.startTime = newStartTime
    booking.endTime = newEndTime
    booking.duration = newDuration
    booking.originalAmount = originalAmount
    booking.memberDiscountAmount = feeDetail.memberDiscountAmount
    booking.couponDiscountAmount = 0
    booking.couponId = undefined
    booking.couponCode = undefined
    booking.totalAmount = feeDetail.totalAmount
    booking.paidAmount = feeDetail.totalAmount
    booking.updatedAt = new Date()
    booking.previousBooking = originalBooking

    dataStore.markUpdated()

    const roomInfo = dataStore.rooms.find(r => r.id === booking.roomId)
    const result = { ...booking, room: roomInfo }

    res.json({
      code: 200,
      message: '改期成功',
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

    if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.COMPLETED) {
      throw new AppError('已核销或已完成的预约不能取消', 400)
    }

    const refundCalc: RefundCalculation = calculateRefund(booking)

    if (booking.deductionType === DeductionType.BALANCE && refundCalc.refundAmount > 0) {
      dataStore.refundWallet(booking.userId, refundCalc.refundAmount)
    } else if (booking.deductionType === DeductionType.TIMES_CARD && booking.timesCardId && (booking.timesCardConsumed || 0) > 0 && refundCalc.refundAmount > 0) {
      dataStore.refundTimesCard(booking.timesCardId, booking.timesCardConsumed)
    }

    if (booking.couponId) {
      const coupon = dataStore.coupons.find(c => c.id === booking.couponId)
      if (coupon && coupon.usedCount > 0) {
        coupon.usedCount--
      }
    }

    booking.status = BookingStatus.CANCELLED
    booking.cancelledAt = new Date()
    booking.cancelReason = reason || refundCalc.reason
    booking.refundStatus = refundCalc.refundAmount > 0
      ? (refundCalc.refundAmount >= (booking.deductionAmount || 0) + (booking.paidAmount || 0)
          ? RefundStatus.REFUNDED
          : RefundStatus.PARTIAL_REFUNDED)
      : RefundStatus.NONE
    booking.refundRule = refundCalc.refundRule
    booking.refundAmount = refundCalc.refundAmount
    booking.refundAt = new Date()
    booking.refundReason = refundCalc.reason
    booking.updatedAt = new Date()

    dataStore.markUpdated()

    const room = dataStore.rooms.find(r => r.id === booking.roomId)
    const result = { ...booking, room, refundInfo: refundCalc }

    res.json({
      code: 200,
      message: '取消成功',
      data: result,
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

    const availability = await isTimeSlotAvailable(
      booking.roomId,
      booking.bookingDate,
      booking.endTime,
      newEndTime,
      booking.id
    )
    if (!availability.available) {
      throw new AppError(`该时段不可用：${availability.reason}`, 400)
    }

    const extendOriginalPrice = calculatePrice(room.pricePerHour, extendDuration)
    const memberLevel = (booking.memberLevel as MemberLevel) || MemberLevel.NORMAL
    const extendFeeDetail = calculateFeeDetail(room.pricePerHour, extendDuration, memberLevel)

    if (extendFeeDetail.finalPayAmount > 0 && booking.deductionType === DeductionType.BALANCE) {
      const wallet = dataStore.wallets.find(w => w.userId === userId)
      if (!wallet || wallet.balance < extendFeeDetail.finalPayAmount) {
        throw new AppError('余额不足', 400)
      }
      dataStore.consumeWallet(userId!, extendFeeDetail.finalPayAmount)
    }

    booking.endTime = newEndTime
    booking.duration += extendDuration
    booking.originalAmount = Math.round((booking.originalAmount + extendOriginalPrice) * 100) / 100
    booking.memberDiscountAmount = Math.round((booking.memberDiscountAmount + extendFeeDetail.memberDiscountAmount) * 100) / 100
    booking.totalAmount = Math.round((booking.totalAmount + extendFeeDetail.totalAmount) * 100) / 100
    booking.paidAmount = Math.round((booking.paidAmount + extendFeeDetail.finalPayAmount) * 100) / 100
    booking.updatedAt = new Date()

    dataStore.markUpdated()

    res.json({
      code: 200,
      message: '续时成功',
      data: {
        booking,
        extendPrice: extendFeeDetail.finalPayAmount,
        extendFeeDetail,
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
    const user = dataStore.users.find(u => u.id === booking.userId)
    const wallet = booking.deductionType === DeductionType.BALANCE
      ? dataStore.wallets.find(w => w.userId === booking.userId)
      : undefined
    const timesCard = booking.deductionType === DeductionType.TIMES_CARD && booking.timesCardId
      ? dataStore.timesCards.find(tc => tc.id === booking.timesCardId)
      : undefined

    const result = {
      ...booking,
      room,
      userInfo: user ? { id: user.id, phone: user.phone, nickname: user.nickname, memberLevel: user.memberLevel } : undefined,
      walletInfo: wallet ? { balance: wallet.balance } : undefined,
      timesCardInfo: timesCard ? { name: timesCard.name, remaining: timesCard.remainingTimes } : undefined,
    }

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

export async function getAllBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('无权限访问，需要管理员权限', 403)
    }

    const { page = 1, pageSize = 10, status, roomId, bookingDate, startDate, endDate, phone } = req.query

    let bookings = [...dataStore.bookings]

    if (status) {
      bookings = bookings.filter(b => b.status === status)
    }

    if (roomId) {
      bookings = bookings.filter(b => b.roomId === roomId)
    }

    if (bookingDate) {
      bookings = bookings.filter(b => b.bookingDate === bookingDate)
    }

    if (startDate) {
      bookings = bookings.filter(b => b.bookingDate >= startDate)
    }

    if (endDate) {
      bookings = bookings.filter(b => b.bookingDate <= endDate)
    }

    if (phone) {
      const phoneStr = phone as string
      const matchedUserIds = dataStore.users
        .filter(u => u.phone.includes(phoneStr))
        .map(u => u.id)
      bookings = bookings.filter(b => matchedUserIds.includes(b.userId))
    }

    bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const total = bookings.length
    const skip = (Number(page) - 1) * Number(pageSize)
    const list = bookings.slice(skip, skip + Number(pageSize))

    const result = list.map(booking => {
      const room = dataStore.rooms.find(r => r.id === booking.roomId)
      const user = dataStore.users.find(u => u.id === booking.userId)
      return {
        ...booking,
        room,
        userInfo: user ? { id: user.id, phone: user.phone, nickname: user.nickname, memberLevel: user.memberLevel } : undefined,
      }
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

export async function getBookingStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('无权限访问，需要管理员权限', 403)
    }

    const { startDate, endDate, roomId } = req.query

    if (!startDate || !endDate) {
      throw new AppError('开始日期和结束日期不能为空', 400)
    }

    const stats = calculateBookingStats(
      startDate as string,
      endDate as string,
      roomId as string | undefined
    )

    res.json({
      code: 200,
      message: '获取成功',
      data: stats,
    })
  } catch (error) {
    next(error)
  }
}

export async function exportBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('无权限访问，需要管理员权限', 403)
    }

    const { status, roomId, bookingDate, startDate, endDate, phone } = req.query

    let bookings = [...dataStore.bookings]

    if (status) {
      bookings = bookings.filter(b => b.status === status)
    }

    if (roomId) {
      bookings = bookings.filter(b => b.roomId === roomId)
    }

    if (bookingDate) {
      bookings = bookings.filter(b => b.bookingDate === bookingDate)
    }

    if (startDate) {
      bookings = bookings.filter(b => b.bookingDate >= startDate)
    }

    if (endDate) {
      bookings = bookings.filter(b => b.bookingDate <= endDate)
    }

    if (phone) {
      const phoneStr = phone as string
      const matchedUserIds = dataStore.users
        .filter(u => u.phone.includes(phoneStr))
        .map(u => u.id)
      bookings = bookings.filter(b => matchedUserIds.includes(b.userId))
    }

    bookings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const statusMap: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      checked_in: '已核销',
      completed: '已完成',
      cancelled: '已取消',
      overtime: '超时',
      no_show: '未到场',
    }

    const refundStatusMap: Record<string, string> = {
      none: '无',
      pending: '待退款',
      refunded: '已退款',
      partial_refunded: '部分退款',
      failed: '退款失败',
    }

    const header = [
      '订单号',
      '创建时间',
      '预约日期',
      '时段',
      '时长(分钟)',
      '用户手机号',
      '用户昵称',
      '琴房名称',
      '原价',
      '会员折扣',
      '优惠券折扣',
      '抵扣金额',
      '实付金额',
      '订单状态',
      '支付方式',
      '核销码',
      '到店时间',
      '退房时间',
      '退款状态',
      '退款金额',
      '取消原因',
    ]

    const rows = bookings.map(booking => {
      const room = dataStore.rooms.find(r => r.id === booking.roomId)
      const user = dataStore.users.find(u => u.id === booking.userId)
      const deductionTypeMap: Record<string, string> = {
        none: '在线支付',
        balance: '余额支付',
        times_card: '次卡抵扣',
      }
      return [
        booking.orderNo,
        dayjs(booking.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        booking.bookingDate,
        `${booking.startTime}-${booking.endTime}`,
        booking.duration,
        user?.phone || '',
        user?.nickname || '',
        room?.name || '',
        booking.originalAmount || booking.totalAmount,
        booking.memberDiscountAmount || 0,
        booking.couponDiscountAmount || 0,
        booking.deductionAmount || 0,
        booking.paidAmount,
        statusMap[booking.status] || booking.status,
        deductionTypeMap[booking.deductionType] || booking.deductionType,
        booking.verificationCode || '',
        booking.checkInTime ? dayjs(booking.checkInTime).format('YYYY-MM-DD HH:mm:ss') : '',
        booking.checkOutTime ? dayjs(booking.checkOutTime).format('YYYY-MM-DD HH:mm:ss') : '',
        refundStatusMap[booking.refundStatus] || booking.refundStatus,
        booking.refundAmount || 0,
        booking.cancelReason || '',
      ]
    })

    const csvContent = [
      header.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const filename = `bookings_${dayjs().format('YYYYMMDD_HHmmss')}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.write('\uFEFF')
    res.write(csvContent)
    res.end()
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

export async function calculateFee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, duration, couponCode, deductionType = 'none', timesCardId } = req.query

    if (!roomId || !duration) {
      throw new AppError('房间ID和时长不能为空', 400)
    }

    const room = dataStore.rooms.find(r => r.id === roomId as string)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    const userId = req.user?.userId
    const user = dataStore.users.find(u => u.id === userId)
    const memberLevel = user?.memberLevel || MemberLevel.NORMAL

    const feeDetail = calculateFeeDetail(
      room.pricePerHour,
      Number(duration),
      memberLevel,
      couponCode as string,
      deductionType as any,
      timesCardId as string,
      userId
    )

    if (feeDetail.deductionType !== DeductionType.NONE && feeDetail.deductionError) {
      throw new AppError(feeDetail.deductionError, 400)
    }

    res.json({
      code: 200,
      message: '计算成功',
      data: {
        roomId,
        duration: Number(duration),
        pricePerHour: room.pricePerHour,
        ...feeDetail,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getConflictCalendarApi(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, roomIds, startDate, endDate } = req.query

    if (!startDate || !endDate) {
      throw new AppError('开始日期和结束日期不能为空', 400)
    }

    const start = dayjs(startDate as string)
    const end = dayjs(endDate as string)
    if (end.diff(start, 'day') > 90) {
      throw new AppError('日期范围不能超过90天', 400)
    }

    if (roomIds && typeof roomIds === 'string') {
      const ids = roomIds.split(',').filter(Boolean)
      if (ids.length > 0) {
        const roomsCalendar = getMultiRoomConflictCalendar(
          ids,
          startDate as string,
          endDate as string
        )

        res.json({
          code: 200,
          message: '获取成功',
          data: {
            startDate,
            endDate,
            rooms: roomsCalendar,
          },
        })
        return
      }
    }

    if (!roomId) {
      throw new AppError('房间ID不能为空', 400)
    }

    const room = dataStore.rooms.find(r => r.id === roomId as string)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    const calendar = getConflictCalendar(
      roomId as string,
      startDate as string,
      endDate as string
    )

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        roomId,
        roomName: room.name,
        startDate,
        endDate,
        calendar,
      },
    })
  } catch (error) {
    next(error)
  }
}
