import { Router } from 'express'
import { createRoom, getRoomById, getRooms, updateRoom, deleteRoom, searchAvailableRooms, getRoomWithAvailability } from '../controllers/room.controller'
import { addUnavailableDate, getUnavailableDates, deleteUnavailableDate } from '../controllers/unavailable-date.controller'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

router.get('/', getRooms)
router.get('/search/available', searchAvailableRooms)
router.get('/:id', getRoomById)
router.get('/:id/availability', getRoomWithAvailability)

router.post('/', authMiddleware, adminMiddleware, createRoom)
router.put('/:id', authMiddleware, adminMiddleware, updateRoom)
router.delete('/:id', authMiddleware, adminMiddleware, deleteRoom)

router.get('/:roomId/unavailable-dates', getUnavailableDates)
router.post('/:roomId/unavailable-dates', authMiddleware, adminMiddleware, addUnavailableDate)
router.delete('/unavailable-dates/:id', authMiddleware, adminMiddleware, deleteUnavailableDate)

export default router
