import { User, UserRole } from '../entities/User'
import { PianoRoom, InstrumentType } from '../entities/PianoRoom'
import { Booking, BookingStatus } from '../entities/Booking'
import { UnavailableDate } from '../entities/UnavailableDate'
import { TemporaryClosure, ClosureType, ClosureStatus } from '../entities/TemporaryClosure'
import * as bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { generateOrderNo, generateVerificationCode } from '../utils/auth'

interface DataStore {
  users: User[]
  rooms: PianoRoom[]
  bookings: Booking[]
  unavailableDates: UnavailableDate[]
  closures: TemporaryClosure[]
}

const store: DataStore = {
  users: [],
  rooms: [],
  bookings: [],
  unavailableDates: [],
  closures: [],
}

async function initData() {
  const hashedAdminPassword = await bcrypt.hash('admin123', 10)
  store.users.push({
    id: uuidv4(),
    phone: '13800138000',
    password: hashedAdminPassword,
    nickname: '超级管理员',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    hashPassword: async function () {
      this.password = await bcrypt.hash(this.password, 10)
    },
    comparePassword: function (password: string) {
      return bcrypt.compare(password, this.password)
    },
  })

  const hashedUserPassword = await bcrypt.hash('user123', 10)
  store.users.push({
    id: uuidv4(),
    phone: '13900139000',
    password: hashedUserPassword,
    nickname: '测试用户',
    role: UserRole.USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    hashPassword: async function () {
      this.password = await bcrypt.hash(this.password, 10)
    },
    comparePassword: function (password: string) {
      return bcrypt.compare(password, this.password)
    },
  })

  const rooms = [
    {
      name: 'A1 豪华钢琴房',
      capacity: 2,
      instruments: [InstrumentType.PIANO],
      openingTime: '08:00',
      closingTime: '22:00',
      pricePerHour: 80,
      description: '配备施坦威三角钢琴，专业隔音设计',
    },
    {
      name: 'A2 标准钢琴房',
      capacity: 2,
      instruments: [InstrumentType.PIANO],
      openingTime: '08:00',
      closingTime: '22:00',
      pricePerHour: 50,
      description: '雅马哈立式钢琴，适合练习',
    },
    {
      name: 'B1 综合琴房',
      capacity: 4,
      instruments: [InstrumentType.PIANO, InstrumentType.VIOLIN, InstrumentType.CELLO],
      openingTime: '09:00',
      closingTime: '21:00',
      pricePerHour: 60,
      description: '小型合奏室，多种乐器可用',
    },
    {
      name: 'C1 打击乐室',
      capacity: 3,
      instruments: [InstrumentType.DRUM, InstrumentType.GUITAR],
      openingTime: '10:00',
      closingTime: '22:00',
      pricePerHour: 70,
      description: '架子鼓与吉他练习室',
    },
    {
      name: 'D1 管弦乐室',
      capacity: 6,
      instruments: [InstrumentType.FLUTE, InstrumentType.SAXOPHONE, InstrumentType.TRUMPET, InstrumentType.VIOLIN],
      openingTime: '09:00',
      closingTime: '20:00',
      pricePerHour: 100,
      description: '大型合奏室，适合管弦乐排练',
    },
  ]

  for (const roomData of rooms) {
    store.rooms.push({
      id: uuidv4(),
      ...roomData,
      isActive: true,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  console.log('测试数据初始化完成')
  console.log('管理员账号: 13800138000 / admin123')
  console.log('普通用户账号: 13900139000 / user123')
  console.log(`已创建 ${rooms.length} 个琴房`)
}

export const dataStore = {
  init: initData,

  get users() {
    return store.users
  },

  get rooms() {
    return store.rooms
  },

  get bookings() {
    return store.bookings
  },

  get unavailableDates() {
    return store.unavailableDates
  },

  get closures() {
    return store.closures
  },

  addUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'hashPassword' | 'comparePassword'> & { password: string }): User {
    const newUser: User = {
      ...user,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      hashPassword: async function () {
        this.password = await bcrypt.hash(this.password, 10)
      },
      comparePassword: function (password: string) {
        return bcrypt.compare(password, this.password)
      },
    }
    store.users.push(newUser)
    return newUser
  },

  addRoom(room: Omit<PianoRoom, 'id' | 'createdAt' | 'updatedAt'>): PianoRoom {
    const newRoom: PianoRoom = {
      ...room,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    store.rooms.push(newRoom)
    return newRoom
  },

  addBooking(booking: Omit<Booking, 'id' | 'orderNo' | 'verificationCode' | 'createdAt' | 'updatedAt' | 'room' | 'user'>): Booking {
    const newBooking: Booking = {
      ...booking,
      id: uuidv4(),
      orderNo: generateOrderNo(),
      verificationCode: generateVerificationCode(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Booking
    store.bookings.push(newBooking)
    return newBooking
  },

  addUnavailableDate(ud: Omit<UnavailableDate, 'id' | 'createdAt' | 'room'>): UnavailableDate {
    const newUd: UnavailableDate = {
      ...ud,
      id: uuidv4(),
      createdAt: new Date(),
    } as UnavailableDate
    store.unavailableDates.push(newUd)
    return newUd
  },

  addClosure(closure: Omit<TemporaryClosure, 'id' | 'createdAt' | 'updatedAt' | 'room'>): TemporaryClosure {
    const newClosure: TemporaryClosure = {
      ...closure,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as TemporaryClosure
    store.closures.push(newClosure)
    return newClosure
  },
}
