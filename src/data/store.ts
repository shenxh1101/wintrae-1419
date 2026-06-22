import { User, UserRole } from '../entities/User'
import { PianoRoom, InstrumentType } from '../entities/PianoRoom'
import { Booking, BookingStatus } from '../entities/Booking'
import { UnavailableDate } from '../entities/UnavailableDate'
import { TemporaryClosure, ClosureType, ClosureStatus } from '../entities/TemporaryClosure'
import { Coupon, CouponType } from '../entities/Coupon'
import { MemberLevel } from '../entities/MemberLevel'
import * as bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { generateOrderNo, generateVerificationCode } from '../utils/auth'
import * as fs from 'fs'
import * as path from 'path'

const DATA_FILE = path.join(__dirname, '../../data.json')

interface DataStore {
  users: User[]
  rooms: PianoRoom[]
  bookings: Booking[]
  unavailableDates: UnavailableDate[]
  closures: TemporaryClosure[]
  coupons: Coupon[]
}

const store: DataStore = {
  users: [],
  rooms: [],
  bookings: [],
  unavailableDates: [],
  closures: [],
  coupons: [],
}

function reviveDates(key: string, value: any): any {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return new Date(value)
  }
  return value
}

function loadFromFile(): boolean {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8')
      const parsed = JSON.parse(data, reviveDates)
      store.users = parsed.users || []
      store.rooms = parsed.rooms || []
      store.bookings = parsed.bookings || []
      store.unavailableDates = parsed.unavailableDates || []
      store.closures = parsed.closures || []
      store.coupons = parsed.coupons || []

      for (const user of store.users) {
        if (!user.memberLevel) {
          user.memberLevel = MemberLevel.NORMAL
        }
        user.hashPassword = async function () {
          this.password = await bcrypt.hash(this.password, 10)
        }
        user.comparePassword = function (password: string) {
          return bcrypt.compare(password, this.password)
        }
      }

      for (const booking of store.bookings) {
        if (booking.originalAmount === undefined) {
          booking.originalAmount = booking.totalAmount
          booking.memberDiscountAmount = 0
          booking.couponDiscountAmount = 0
        }
      }

      console.log(`从数据文件加载: ${store.users.length} 用户, ${store.rooms.length} 琴房, ${store.bookings.length} 预约, ${store.coupons.length} 优惠券`)
      return true
    }
  } catch (error) {
    console.warn('读取数据文件失败，将初始化新数据:', error instanceof Error ? error.message : error)
  }
  return false
}

function saveToFile(): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8')
  } catch (error) {
    console.error('保存数据文件失败:', error instanceof Error ? error.message : error)
  }
}

let saveTimeout: NodeJS.Timeout | null = null
function scheduleSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(() => {
    saveToFile()
    saveTimeout = null
  }, 100)
}

async function initData() {
  const loaded = loadFromFile()

  if (!loaded) {
    const hashedAdminPassword = await bcrypt.hash('admin123', 10)
    store.users.push({
      id: uuidv4(),
      phone: '13800138000',
      password: hashedAdminPassword,
      nickname: '超级管理员',
      role: UserRole.ADMIN,
      memberLevel: MemberLevel.NORMAL,
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
      memberLevel: MemberLevel.GOLD,
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

    const today = new Date().toISOString().slice(0, 10)
    store.coupons.push({
      id: uuidv4(),
      code: 'WELCOME20',
      name: '新客立减20元',
      type: CouponType.FIXED,
      value: 20,
      minAmount: 50,
      validFrom: today,
      validUntil: '2027-12-31',
      usageLimit: 1000,
      usedCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    store.coupons.push({
      id: uuidv4(),
      code: 'PIANO10',
      name: '钢琴房9折券',
      type: CouponType.PERCENTAGE,
      value: 10,
      minAmount: 0,
      maxDiscount: 50,
      validFrom: today,
      validUntil: '2027-12-31',
      usageLimit: 500,
      usedCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log('测试数据初始化完成')
    scheduleSave()
  }

  console.log('管理员账号: 13800138000 / admin123')
  console.log('普通用户账号: 13900139000 / user123 (黄金会员)')
  console.log(`已加载 ${store.rooms.length} 个琴房, ${store.coupons.length} 个优惠券`)
  console.log(`数据文件: ${DATA_FILE}`)
}

export const dataStore = {
  init: initData,
  save: saveToFile,

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

  get coupons() {
    return store.coupons
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
    scheduleSave()
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
    scheduleSave()
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
    scheduleSave()
    return newBooking
  },

  addUnavailableDate(ud: Omit<UnavailableDate, 'id' | 'createdAt' | 'room'>): UnavailableDate {
    const newUd: UnavailableDate = {
      ...ud,
      id: uuidv4(),
      createdAt: new Date(),
    } as UnavailableDate
    store.unavailableDates.push(newUd)
    scheduleSave()
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
    scheduleSave()
    return newClosure
  },

  addCoupon(coupon: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'>): Coupon {
    const newCoupon: Coupon = {
      ...coupon,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    store.coupons.push(newCoupon)
    scheduleSave()
    return newCoupon
  },

  markUpdated(): void {
    scheduleSave()
  },
}
