import { Router } from 'express'
import { createClosure, getClosures, cancelClosure } from '../controllers/closure.controller'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

router.get('/', getClosures)
router.post('/', authMiddleware, adminMiddleware, createClosure)
router.put('/:id/cancel', authMiddleware, adminMiddleware, cancelClosure)

export default router
