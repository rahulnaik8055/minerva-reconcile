import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d' })
  id!: string;

  @ApiProperty({ example: 'user_2abc123' })
  clerkId!: string;

  @ApiProperty({ example: 'jane@company.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Smith' })
  fullName!: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt!: string;
}
