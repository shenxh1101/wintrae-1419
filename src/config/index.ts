export default {
  port: 3000,
  jwtSecret: 'piano-room-booking-secret-key-2024',
  jwtExpiresIn: '7d',
  database: {
    type: 'sqlite',
    database: './piano_room.db',
    synchronize: true,
    logging: false,
  },
  booking: {
    minDuration: 30,
    maxDuration: 240,
    unitDuration: 30,
    pricePerHour: 50,
    overtimeTolerance: 15,
    reminderBeforeStart: 15,
  },
  refund: {
    fullRefundBeforeMinutes: 120,
    partialRefundBeforeMinutes: 30,
    partialRefundRate: 0.5,
    noRefundAfterStart: true,
  },
}
