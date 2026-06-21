import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { dataStore } from '../data/store'
import { BookingStatus } from '../entities/Booking'
import { ClosureStatus } from '../entities/TemporaryClosure'

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

export async function checkRoomAvailability(
  roomId: string,
  date: string
): Promise<{ available: boolean; reason?: string }> {
  const room = dataStore.rooms.find(r => r.id === roomId && r.isActive)
  if (!room) {
    return { available: false, reason: '琴房不存在或已停用' }
  }

  const activeClosures = dataStore.closures.filter(
    c => c.roomId === roomId && c.status === ClosureStatus.ACTIVE
  )

  for (const closure of activeClosures) {
    const startDate = dayjs(closure.startDate)
    const endDate = dayjs(closure.endDate)
    const targetDate = dayjs(date)

    if (targetDate.isBetween(startDate, endDate, 'day', '[]')) {
      if (closure.type === 'full_day') {
        return { available: false, reason: '该日期临时闭店' }
      }
    }
  }

  const unavailableDates = dataStore.unavailableDates.filter(
    ud => ud.roomId === roomId && ud.date === date
  )

  if (unavailableDates.length > 0) {
    const fullDayUnavailable = unavailableDates.some(ud => !ud.startTime && !ud.endTime)
    if (fullDayUnavailable) {
      return { available: false, reason: '该日期不可预约' }
    }
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

  const bookings = dataStore.bookings.filter(
    b => b.roomId === roomId &&
      b.bookingDate === date &&
      (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.CHECKED_IN)
  )

  const unavailableDates = dataStore.unavailableDates.filter(
    ud => ud.roomId === roomId && ud.date === date
  )

  for (const slot of timeSlots) {
    const slotStart = timeToMinutes(slot.startTime)
    const slotEnd = timeToMinutes(slot.endTime)

    for (const booking of bookings) {
      const bookingStart = timeToMinutes(booking.startTime)
      const bookingEnd = timeToMinutes(booking.endTime)

      if (slotStart < bookingEnd && slotEnd > bookingStart) {
        slot.available = false
        break
      }
    }

    if (!slot.available) continue

    for (const ud of unavailableDates) {
      if (ud.startTime && ud.endTime) {
        const udStart = timeToMinutes(ud.startTime)
        const udEnd = timeToMinutes(ud.endTime)
        if (slotStart < udEnd && slotEnd > udStart) {
          slot.available = false
          break
        }
      } else {
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
): Promise<boolean> {
  const room = dataStore.rooms.find(r => r.id === roomId && r.isActive)
  if (!room) return false

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const openMinutes = timeToMinutes(room.openingTime)
  const closeMinutes = timeToMinutes(room.closingTime)

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    return false
  }

  const availabilityCheck = await checkRoomAvailability(roomId, date)
  if (!availabilityCheck.available) {
    return false
  }

  const bookings = dataStore.bookings.filter(
    b => b.roomId === roomId &&
      b.bookingDate === date &&
      (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.CHECKED_IN) &&
      (!excludeBookingId || b.id !== excludeBookingId)
  )

  for (const booking of bookings) {
    const bookingStart = timeToMinutes(booking.startTime)
    const bookingEnd = timeToMinutes(booking.endTime)
    if (startMinutes < bookingEnd && endMinutes > bookingStart) {
      return false
    }
  }

  return true
}

export function calculatePrice(pricePerHour: number, durationMinutes: number): number {
  const hours = durationMinutes / 60
  return Math.round(pricePerHour * hours * 100) / 100
}
