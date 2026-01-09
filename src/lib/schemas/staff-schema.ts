import { z } from "zod";
import { userRoleV4 } from "@drizzle/schema";

export const createStaffSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  role: z.enum(userRoleV4.enumValues),
});

export type CreateStaffSchema = z.infer<typeof createStaffSchema>;

export const editStaffSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }).optional(),
  email: z.email({ message: "Invalid email address" }).optional(),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).optional(),
  role: z.enum(userRoleV4.enumValues).optional(),
  isActive: z.boolean().optional(),
});

export type EditStaffSchema = z.infer<typeof editStaffSchema>;

