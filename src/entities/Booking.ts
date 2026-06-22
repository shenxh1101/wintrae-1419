import { User } from './User'
import { PianoRoom } from './PianoRoom'

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  OVERTIME = 'overtime',
  NO_SHOW = 'no_show',
}

export class Booking {
  id: string

  orderNo: string

  userId: string

  user?: User

  roomId: string

  room?: PianoRoom

  bookingDate: string

  startTime: string

  endTime: string

  duration: number

  peopleCount: number

  status: BookingStatus

  originalAmount: number

  memberDiscountAmount: number

  couponDiscountAmount: number

  totalAmount: number

  paidAmount: number

  memberLevel?: string

  couponId?: string

  couponCode?: string

  verificationCode?: string

  checkInTime?: Date

  checkOutTime?: Date

  cancelledAt?: Date

  cancelReason?: string

  reminderSent: boolean

  overtimeReminderSent: boolean

  previousBooking?: {
    bookingDate: string
    startTime: string
    endTime: string
    duration: number
  }

  createdAt: Date

  updatedAt: Date
}
