export class UserWallet {
  id: string

  userId: string

  balance: number

  totalRecharged: number

  totalConsumed: number

  createdAt: Date

  updatedAt: Date
}

export class StoredValueCard {
  id: string

  cardNo: string

  name: string

  faceValue: number

  actualPrice: number

  balance: number

  userId: string

  isActive: boolean

  validFrom: string

  validUntil: string

  createdAt: Date

  updatedAt: Date
}

export enum TimesCardStatus {
  ACTIVE = 'active',
  USED_UP = 'used_up',
  EXPIRED = 'expired',
}

export class TimesCard {
  id: string

  cardNo: string

  name: string

  totalTimes: number

  usedTimes: number

  remainingTimes: number

  userId: string

  status: TimesCardStatus

  validFrom: string

  validUntil: string

  instrumentType?: string

  createdAt: Date

  updatedAt: Date
}

export enum DeductionType {
  NONE = 'none',
  BALANCE = 'balance',
  TIMES_CARD = 'times_card',
}
