import { dataStore } from '../data/store'
import { InstrumentType } from '../entities/PianoRoom'
import { getAvailableTimeSlots } from './booking.service'

export interface SearchRoomsDto {
  date?: string
  peopleCount?: number
  instrument?: InstrumentType
  startTime?: string
  duration?: number
  page?: number
  pageSize?: number
}

export interface RoomWithAvailability {
  id: string
  name: string
  capacity: number
  instruments: InstrumentType[]
  openingTime: string
  closingTime: string
  pricePerHour: number
  description?: string
  images?: string[]
  isActive: boolean
  rating?: number
  reviewCount: number
  createdAt: Date
  updatedAt: Date
  availableSlots: {
    startTime: string
    endTime: string
    available: boolean
  }[]
  isAvailable: boolean
}

export async function searchRooms(dto: SearchRoomsDto): Promise<{
  list: RoomWithAvailability[]
  total: number
}> {
  const { date, peopleCount, instrument, startTime, duration = 30, page = 1, pageSize = 10 } = dto

  let rooms = dataStore.rooms.filter(r => r.isActive)

  if (peopleCount) {
    rooms = rooms.filter(r => r.capacity >= peopleCount)
  }

  if (instrument) {
    rooms = rooms.filter(r => r.instruments.includes(instrument))
  }

  const total = rooms.length
  const skip = (page - 1) * pageSize
  const paginatedRooms = rooms.slice(skip, skip + pageSize)

  const result: RoomWithAvailability[] = []

  for (const room of paginatedRooms) {
    const roomWithAvail = room as RoomWithAvailability

    if (date) {
      const timeSlots = await getAvailableTimeSlots(room.id, date, duration)
      roomWithAvail.availableSlots = timeSlots

      if (startTime) {
        const slot = timeSlots.find(s => s.startTime === startTime)
        roomWithAvail.isAvailable = slot?.available || false
      } else {
        roomWithAvail.isAvailable = timeSlots.some(s => s.available)
      }
    } else {
      roomWithAvail.availableSlots = []
      roomWithAvail.isAvailable = true
    }

    result.push(roomWithAvail)
  }

  return { list: result, total }
}

export async function getRoomDetail(roomId: string, date?: string): Promise<RoomWithAvailability | null> {
  const room = dataStore.rooms.find(r => r.id === roomId && r.isActive)
  if (!room) return null

  const roomWithAvail = room as RoomWithAvailability

  if (date) {
    const timeSlots = await getAvailableTimeSlots(roomId, date, 30)
    roomWithAvail.availableSlots = timeSlots
    roomWithAvail.isAvailable = timeSlots.some(s => s.available)
  } else {
    roomWithAvail.availableSlots = []
    roomWithAvail.isAvailable = true
  }

  return roomWithAvail
}
