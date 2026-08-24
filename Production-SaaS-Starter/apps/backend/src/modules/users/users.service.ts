import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { users } from '../../database/schema';
import { DatabaseConnection } from '../../interfaces/database.interface';
import { CreateUserInput } from './interfaces/create-user.input';
import { UserResponseDto } from './dto/user-response.dto';

export type UserRow = typeof users.$inferSelect;

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection) {}

  async create(input: CreateUserInput): Promise<UserRow> {
    const [user] = await this.database.db.insert(users).values(input).returning();

    return user;
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const result = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  async findById(id: string): Promise<UserRow | undefined> {
    const result = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1);

    return result[0];
  }

  toPublicUser(user: UserRow): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
