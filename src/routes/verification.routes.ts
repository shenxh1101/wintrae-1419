import { Router } from 'express'
import { checkIn, checkOut, getOvertimeBookings, getUpcomingReminders } from '../controllers/verification.controller'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

router.post('/check-in', authMiddleware, checkIn)
router.post('/check-out', authMiddleware, checkOut)
router.get('/overtime', authMiddleware, adminMiddleware, getOvertimeBookings)
router.get('/upcoming-reminders', authMiddleware, getUpcomingReminders)

export default router
