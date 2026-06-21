import { PianoRoom } from './PianoRoom'

export class UnavailableDate {
  id: string

  roomId: string

  room?: PianoRoom

  date: string

  startTime?: string

  endTime?: string

  reason?: string

  createdAt: Date
}
