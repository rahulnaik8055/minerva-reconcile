import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
});

export type RegisterDto = z.infer<typeof registerSchema>;
