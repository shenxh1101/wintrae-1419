import { PianoRoom } from './PianoRoom'

export enum ClosureType {
  FULL_DAY = 'full_day',
  PARTIAL = 'partial',
}

export enum ClosureStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

export class TemporaryClosure {
  id: string

  roomId: string

  room?: PianoRoom

  type: ClosureType

  startDate: string

  endDate: string

  startTime?: string

  endTime?: string

  reason?: string

  status: ClosureStatus

  createdAt: Date

  updatedAt: Date
}
