export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class Coupon {
  id: string

  code: string

  name: string

  type: CouponType

  value: number

  minAmount: number

  maxDiscount?: number

  validFrom: string

  validUntil: string

  usageLimit: number

  usedCount: number

  isActive: boolean

  createdAt: Date

  updatedAt: Date
}
