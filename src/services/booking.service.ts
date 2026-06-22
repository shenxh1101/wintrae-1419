import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { dataStore } from '../data/store'
import { BookingStatus } from '../entities/Booking'
import { ClosureStatus, ClosureType } from '../entities/TemporaryClosure'
import { MemberLevel, MemberDiscounts } from '../entities/MemberLevel'
import { CouponType } from '../entities/Coupon'

dayjs.extend(isBetween)

export interface TimeSlotInfo {
  startTime: string
  endTime: string
  available: boolean
}

export interface RoomAvailability {
  roomId: string
  roomName: string
  date: string
  timeSlots: TimeSlotInfo[]
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

export function checkTimeOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2
}

export function getUnavailablePeriods(roomId: string, date: string): Array<{ start: number; end: number; reason: string }> {
  const periods: Array<{ start: number; end: number; reason: string }> = []

  const room = dataStore.rooms.find(r => r.id === roomId)
  if (!room) return periods

  const activeClosures = dataStore.closures.filter(
    c => c.roomId === roomId && c.status === ClosureStatus.ACTIVE
  )

  for (const closure of activeClosures) {
    const startDate = dayjs(closure.startDate)
    const endDate = dayjs(closure.endDate)
    const targetDate = dayjs(date)

    if (targetDate.isBetween(startDate, endDate, 'day', '[]')) {
      if (closure.type === ClosureType.FULL_DAY) {
        periods.push({
          start: 0,
          end: 1440,
          reason: '临时闭店',
        })
      } else if (closure.type === ClosureType.PARTIAL && closure.startTime && closure.endTime) {
        periods.push({
          start: timeToMinutes(closure.startTime),
          end: timeToMinutes(closure.endTime),
          reason: '临时闭店',
        })
      }
    }
  }

  const unavailableDates = dataStore.unavailableDates.filter(
    ud => ud.roomId === roomId && ud.date === date
  )

  for (const ud of unavailableDates) {
    if (ud.startTime && ud.endTime) {
      periods.push({
        start: timeToMinutes(ud.startTime),
        end: timeToMinutes(ud.endTime),
        reason: '不可预约时段',
      })
    } else {
      periods.push({
        start: 0,
        end: 1440,
        reason: '不可预约日期',
      })
    }
  }

  const bookings = dataStore.bookings.filter(
    b => b.roomId === roomId &&
      b.bookingDate === date &&
      (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.CHECKED_IN)
  )

  for (const booking of bookings) {
    periods.push({
      start: timeToMinutes(booking.startTime),
      end: timeToMinutes(booking.endTime),
      reason: '已被预约',
    })
  }

  return periods
}

export async function checkRoomAvailability(
  roomId: string,
  date: string
): Promise<{ available: boolean; reason?: string }> {
  const room = dataStore.rooms.find(r => r.id === roomId && r.isActive)
  if (!room) {
    return { available: false, reason: '琴房不存在或已停用' }
  }

  const periods = getUnavailablePeriods(roomId, date)
  const fullDayBlocked = periods.some(p => p.start === 0 && p.end === 1440)

  if (fullDayBlocked) {
    const fullDayPeriod = periods.find(p => p.start === 0 && p.end === 1440)
    return { available: false, reason: fullDayPeriod?.reason || '该日期不可预约' }
  }

  return { available: true }
}

export async function getAvailableTimeSlots(
  roomId: string,
  date: string,
  duration: number = 30
): Promise<TimeSlotInfo[]> {
  const room = dataStore.rooms.find(r => r.id === roomId && r.isActive)
  if (!room) {
    return []
  }

  const openingMinutes = timeToMinutes(room.openingTime)
  const closingMinutes = timeToMinutes(room.closingTime)

  const timeSlots: TimeSlotInfo[] = []
  for (let start = openingMinutes; start + duration <= closingMinutes; start += duration) {
    const end = start + duration
    timeSlots.push({
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      available: true,
    })
  }

  const unavailablePeriods = getUnavailablePeriods(roomId, date)

  for (const slot of timeSlots) {
    const slotStart = timeToMinutes(slot.startTime)
    const slotEnd = timeToMinutes(slot.endTime)

    for (const period of unavailablePeriods) {
      if (checkTimeOverlap(slotStart, slotEnd, period.start, period.end)) {
        slot.available = false
        break
      }
    }
  }

  return timeSlots
}

export async function isTimeSlotAvailable(
  roomId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<{ available: boolean; reason?: string }> {
  const room = dataStore.rooms.find(r => r.id === roomId && r.isActive)
  if (!room) return { available: false, reason: '琴房不存在或已停用' }

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const openMinutes = timeToMinutes(room.openingTime)
  const closeMinutes = timeToMinutes(room.closingTime)

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    return { available: false, reason: `超出营业时间 (${room.openingTime} - ${room.closingTime})` }
  }

  let unavailablePeriods = getUnavailablePeriods(roomId, date)

  if (excludeBookingId) {
    unavailablePeriods = unavailablePeriods.filter(p => {
      if (p.reason !== '已被预约') return true
      const booking = dataStore.bookings.find(b =>
        b.roomId === roomId &&
        b.bookingDate === date &&
        timeToMinutes(b.startTime) === p.start &&
        timeToMinutes(b.endTime) === p.end
      )
      return !booking || booking.id !== excludeBookingId
    })
  }

  for (const period of unavailablePeriods) {
    if (checkTimeOverlap(startMinutes, endMinutes, period.start, period.end)) {
      return { available: false, reason: period.reason }
    }
  }

  return { available: true }
}

export function calculatePrice(pricePerHour: number, durationMinutes: number): number {
  const hours = durationMinutes / 60
  return Math.round(pricePerHour * hours * 100) / 100
}

export function validateTimeRange(
  startTime: string,
  endTime: string,
  duration: number
): { valid: boolean; reason?: string } {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  if (end <= start) {
    return { valid: false, reason: '结束时间必须晚于开始时间' }
  }

  const actualDuration = end - start
  if (actualDuration !== duration) {
    return { valid: false, reason: `时长与起止时间不一致（实际时长 ${actualDuration} 分钟，给定 ${duration} 分钟）` }
  }

  if (duration < 30) {
    return { valid: false, reason: '预约时长最少 30 分钟' }
  }

  if (duration > 240) {
    return { valid: false, reason: '单次预约最长 240 分钟' }
  }

  if (duration % 30 !== 0) {
    return { valid: false, reason: '预约时长必须是 30 分钟的整数倍' }
  }

  return { valid: true }
}

export interface FeeCalculation {
  originalAmount: number
  memberLevel: MemberLevel
  memberDiscountRate: number
  memberDiscountAmount: number
  afterMemberDiscount: number
  couponId?: string
  couponCode?: string
  couponName?: string
  couponType?: CouponType
  couponValue?: number
  couponDiscountAmount: number
  totalAmount: number
}

export function calculateFeeDetail(
  pricePerHour: number,
  durationMinutes: number,
  memberLevel: MemberLevel,
  couponCode?: string
): FeeCalculation {
  const originalAmount = calculatePrice(pricePerHour, durationMinutes)
  const memberDiscountRate = MemberDiscounts[memberLevel] || 1.0
  const memberDiscountAmount = Math.round((originalAmount * (1 - memberDiscountRate)) * 100) / 100
  const afterMemberDiscount = Math.round((originalAmount - memberDiscountAmount) * 100) / 100

  let couponDiscountAmount = 0
  let couponId: string | undefined
  let couponName: string | undefined
  let couponType: CouponType | undefined
  let couponValue: number | undefined

  if (couponCode) {
    const today = dayjs().format('YYYY-MM-DD')
    const coupon = dataStore.coupons.find(
      c => c.code === couponCode && c.isActive && c.validFrom <= today && c.validUntil >= today && c.usedCount < c.usageLimit
    )

    if (coupon) {
      couponId = coupon.id
      couponName = coupon.name
      couponType = coupon.type
      couponValue = coupon.value

      if (afterMemberDiscount >= coupon.minAmount) {
        if (coupon.type === CouponType.PERCENTAGE) {
          couponDiscountAmount = Math.round(afterMemberDiscount * (coupon.value / 100) * 100) / 100
          if (coupon.maxDiscount && couponDiscountAmount > coupon.maxDiscount) {
            couponDiscountAmount = coupon.maxDiscount
          }
        } else if (coupon.type === CouponType.FIXED) {
          couponDiscountAmount = Math.min(coupon.value, afterMemberDiscount)
        }
      }
    }
  }

  const totalAmount = Math.max(0, Math.round((afterMemberDiscount - couponDiscountAmount) * 100) / 100)

  return {
    originalAmount,
    memberLevel,
    memberDiscountRate,
    memberDiscountAmount,
    afterMemberDiscount,
    couponId,
    couponCode,
    couponName,
    couponType,
    couponValue,
    couponDiscountAmount,
    totalAmount,
  }
}

export interface CalendarDaySlot {
  startTime: string
  endTime: string
  type: 'booked' | 'closure' | 'unavailable'
  reason: string
  bookingId?: string
  orderNo?: string
  userName?: string
}

export interface CalendarDay {
  date: string
  slots: CalendarDaySlot[]
}

export function getConflictCalendar(
  roomId: string,
  startDate: string,
  endDate: string
): CalendarDay[] {
  const result: CalendarDay[] = []
  let current = dayjs(startDate)
  const end = dayjs(endDate)

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD')
    const slots: CalendarDaySlot[] = []

    const bookings = dataStore.bookings.filter(
      b => b.roomId === roomId &&
        b.bookingDate === dateStr &&
        (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.CHECKED_IN)
    )

    for (const booking of bookings) {
      const user = dataStore.users.find(u => u.id === booking.userId)
      slots.push({
        startTime: booking.startTime,
        endTime: booking.endTime,
        type: 'booked',
        reason: '已被预约',
        bookingId: booking.id,
        orderNo: booking.orderNo,
        userName: user?.nickname || user?.phone,
      })
    }

    const activeClosures = dataStore.closures.filter(
      c => c.roomId === roomId && c.status === ClosureStatus.ACTIVE
    )

    for (const closure of activeClosures) {
      const cStart = dayjs(closure.startDate)
      const cEnd = dayjs(closure.endDate)

      if (current.isBetween(cStart, cEnd, 'day', '[]')) {
        if (closure.type === ClosureType.FULL_DAY) {
          slots.push({
            startTime: '00:00',
            endTime: '23:59',
            type: 'closure',
            reason: closure.reason || '临时闭店',
          })
        } else if (closure.type === ClosureType.PARTIAL && closure.startTime && closure.endTime) {
          slots.push({
            startTime: closure.startTime,
            endTime: closure.endTime,
            type: 'closure',
            reason: closure.reason || '临时闭店（部分时段）',
          })
        }
      }
    }

    const unavailableDates = dataStore.unavailableDates.filter(
      ud => ud.roomId === roomId && ud.date === dateStr
    )

    for (const ud of unavailableDates) {
      slots.push({
        startTime: ud.startTime || '00:00',
        endTime: ud.endTime || '23:59',
        type: 'unavailable',
        reason: ud.reason || '不可预约',
      })
    }

    slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

    result.push({
      date: dateStr,
      slots,
    })

    current = current.add(1, 'day')
  }

  return result
}
