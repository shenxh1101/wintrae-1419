import { Router } from 'express'
import {
  createBooking,
  rescheduleBooking,
  cancelBooking,
  extendBooking,
  getBookingById,
  getMyBookings,
  getAllBookings,
  getBookingStats,
  exportBookings,
  checkAvailability,
  calculateFee,
  getConflictCalendarApi,
} from '../controllers/booking.controller'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

router.get('/availability', checkAvailability)
router.get('/calculate-fee', authMiddleware, calculateFee)
router.get('/conflict-calendar', getConflictCalendarApi)

router.post('/', authMiddleware, createBooking)
router.get('/my', authMiddleware, getMyBookings)
router.get('/all', authMiddleware, adminMiddleware, getAllBookings)
router.get('/stats', authMiddleware, adminMiddleware, getBookingStats)
router.get('/export', authMiddleware, adminMiddleware, exportBookings)
router.get('/:id', authMiddleware, getBookingById)
router.post('/:id/reschedule', authMiddleware, rescheduleBooking)
router.post('/:id/cancel', authMiddleware, cancelBooking)
router.post('/:id/extend', authMiddleware, extendBooking)

export default router
