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

export enum RefundStatus {
  NONE = 'none',
  PENDING = 'pending',
  REFUNDED = 'refunded',
  PARTIAL_REFUNDED = 'partial_refunded',
  FAILED = 'failed',
}

export enum RefundRule {
  FULL_REFUND = 'full_refund',
  PARTIAL_REFUND = 'partial_refund',
  NO_REFUND = 'no_refund',
}

export enum DeductionType {
  NONE = 'none',
  BALANCE = 'balance',
  TIMES_CARD = 'times_card',
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

  deductionType: DeductionType

  deductionAmount: number

  timesCardId?: string

  timesCardConsumed?: number

  memberLevel?: string

  couponId?: string

  couponCode?: string

  refundStatus: RefundStatus

  refundRule?: RefundRule

  refundAmount: number

  refundAt?: Date

  refundReason?: string

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
