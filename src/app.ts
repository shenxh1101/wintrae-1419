import express, { json, urlencoded } from 'express'
import { Request, Response } from 'express'
import userRoutes from './routes/user.routes'
import roomRoutes from './routes/room.routes'
import bookingRoutes from './routes/booking.routes'
import verificationRoutes from './routes/verification.routes'
import closureRoutes from './routes/closure.routes'
import { errorHandler, notFoundHandler } from './middleware/error'

const app = express()

app.use(json())
app.use(urlencoded({ extended: true }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    code: 200,
    message: 'OK',
    data: {
      service: 'piano-room-booking',
      status: 'running',
      timestamp: new Date().toISOString(),
    },
  })
})

app.use('/api/users', userRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/verification', verificationRoutes)
app.use('/api/closures', closureRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
