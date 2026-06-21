export enum InstrumentType {
  PIANO = 'piano',
  VIOLIN = 'violin',
  GUITAR = 'guitar',
  DRUM = 'drum',
  CELLO = 'cello',
  FLUTE = 'flute',
  SAXOPHONE = 'saxophone',
  TRUMPET = 'trumpet',
}

export class PianoRoom {
  id: string

  name: string

  capacity: number

  instruments: InstrumentType[]

  openingTime: string

  closingTime: string

  pricePerHour: number

  description?: string

  images?: string[]

  isActive: boolean

  rating?: number

  reviewCount: number

  createdAt: Date

  updatedAt: Date
}
