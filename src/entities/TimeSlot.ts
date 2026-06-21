import { PianoRoom } from './PianoRoom'

export class TimeSlot {
  id: string

  roomId: string

  room?: PianoRoom

  date: string

  startTime: string

  endTime: string

  isAvailable: boolean

  duration: number
}
