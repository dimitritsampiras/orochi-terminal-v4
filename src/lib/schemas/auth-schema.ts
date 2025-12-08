import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, { message: 'Email or username is required' }),
  password: z.string().min(4, { message: 'Password must be at least 4 characters' }) //TODO: change once switched to prod supabase
});
