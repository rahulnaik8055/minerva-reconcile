import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(255, { message: 'Full name must be at most 255 characters long' })
  fullName!: string;

  @ApiProperty({ example: 'jane@company.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Email must be at most 255 characters long' })
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  password!: string;
}
