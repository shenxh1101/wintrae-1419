import { IsEmail, IsPhoneNumber, IsEnum, IsOptional } from 'class-validator'
import * as bcrypt from 'bcryptjs'
import { MemberLevel } from './MemberLevel'

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export class User {
  id: string

  @IsPhoneNumber('CN')
  phone: string

  password: string

  @IsOptional()
  nickname?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsEnum(UserRole)
  role: UserRole

  memberLevel: MemberLevel

  isActive: boolean

  createdAt: Date

  updatedAt: Date

  async hashPassword(): Promise<void> {
    this.password = await bcrypt.hash(this.password, 10)
  }

  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password)
  }
}
