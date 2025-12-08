import { z } from 'zod';
import { userRole } from '../../../drizzle/schema';

export const createUserSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Invalid email address' }).optional(),
  phone: z
    .string()
    .min(7, { message: 'Phone number must be at least 7 digits' })
    .max(20, { message: 'Phone number is too long' })
    .regex(/^[+\d\s()-]+$/, {
      message: 'Phone number can only contain digits, spaces, and the characters +()-'
    })
    .optional(),
  role: z.enum(userRole.enumValues),
  location_ids: z
    .array(z.string())
    .min(1, { message: 'At least one location is required' })
    .optional()
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;

export const editUserSchema = createUserSchema.partial().extend({
  active: z.boolean().optional()
});

export type EditUserSchema = z.infer<typeof editUserSchema>;
