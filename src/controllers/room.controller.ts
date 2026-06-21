import { Request, Response, NextFunction } from 'express'
import { dataStore } from '../data/store'
import { InstrumentType } from '../entities/PianoRoom'
import { AppError } from '../middleware/error'
import { AuthRequest } from '../middleware/auth'
import { searchRooms, getRoomDetail } from '../services/room.service'

export interface CreateRoomDto {
  name: string
  capacity: number
  instruments: InstrumentType[]
  openingTime: string
  closingTime: string
  pricePerHour: number
  description?: string
  images?: string[]
}

export interface UpdateRoomDto {
  name?: string
  capacity?: number
  instruments?: InstrumentType[]
  openingTime?: string
  closingTime?: string
  pricePerHour?: number
  description?: string
  images?: string[]
  isActive?: boolean
}

export async function createRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, capacity, instruments, openingTime, closingTime, pricePerHour, description, images } = req.body as CreateRoomDto

    if (!name || !capacity || !instruments || instruments.length === 0) {
      throw new AppError('请填写完整的琴房信息', 400)
    }

    const room = dataStore.addRoom({
      name,
      capacity,
      instruments,
      openingTime: openingTime || '08:00',
      closingTime: closingTime || '22:00',
      pricePerHour: pricePerHour || 50,
      description,
      images: images || [],
      isActive: true,
      reviewCount: 0,
    })

    res.status(201).json({
      code: 200,
      message: '创建成功',
      data: room,
    })
  } catch (error) {
    next(error)
  }
}

export async function getRoomById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    const room = dataStore.rooms.find(r => r.id === id && r.isActive)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: room,
    })
  } catch (error) {
    next(error)
  }
}

export async function getRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, pageSize = 10, keyword, instrument, minCapacity, isActive } = req.query

    let rooms = [...dataStore.rooms]

    if (keyword) {
      rooms = rooms.filter(r => r.name.includes(keyword as string))
    }

    if (instrument) {
      rooms = rooms.filter(r => r.instruments.includes(instrument as InstrumentType))
    }

    if (minCapacity) {
      rooms = rooms.filter(r => r.capacity >= Number(minCapacity))
    }

    if (isActive !== undefined) {
      rooms = rooms.filter(r => r.isActive === (isActive === 'true'))
    }

    const total = rooms.length
    const skip = (Number(page) - 1) * Number(pageSize)
    const list = rooms.slice(skip, skip + Number(pageSize))

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        list,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function updateRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const updateData = req.body as UpdateRoomDto

    const roomIndex = dataStore.rooms.findIndex(r => r.id === id)
    if (roomIndex === -1) {
      throw new AppError('琴房不存在', 404)
    }

    const room = dataStore.rooms[roomIndex]
    Object.assign(room, updateData)
    room.updatedAt = new Date()

    res.json({
      code: 200,
      message: '更新成功',
      data: room,
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    const room = dataStore.rooms.find(r => r.id === id)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    room.isActive = false
    room.updatedAt = new Date()

    res.json({
      code: 200,
      message: '删除成功',
      data: null,
    })
  } catch (error) {
    next(error)
  }
}

export async function searchAvailableRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { date, peopleCount, instrument, startTime, duration, page, pageSize } = req.query

    const result = await searchRooms({
      date: date as string,
      peopleCount: peopleCount ? Number(peopleCount) : undefined,
      instrument: instrument as InstrumentType | undefined,
      startTime: startTime as string,
      duration: duration ? Number(duration) : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
    })

    res.json({
      code: 200,
      message: '获取成功',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

export async function getRoomWithAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { date } = req.query

    const room = await getRoomDetail(id, date as string)
    if (!room) {
      throw new AppError('琴房不存在', 404)
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: room,
    })
  } catch (error) {
    next(error)
  }
}
