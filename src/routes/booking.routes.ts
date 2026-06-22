import { Router } from 'express'
import {
  createBooking,
  rescheduleBooking,
  cancelBooking,
  extendBooking,
  getBookingById,
  getMyBookings,
  checkAvailability,
  calculateFee,
} from '../controllers/booking.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.get('/availability', checkAvailability)
router.get('/calculate-fee', calculateFee)

router.post('/', authMiddleware, createBooking)
router.get('/my', authMiddleware, getMyBookings)
router.get('/:id', authMiddleware, getBookingById)
router.post('/:id/reschedule', authMiddleware, rescheduleBooking)
router.post('/:id/cancel', authMiddleware, cancelBooking)
router.post('/:id/extend', authMiddleware, extendBooking)

export default router
