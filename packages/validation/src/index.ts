import { z } from 'zod';

export const publicIdSchema = z.string().min(8).max(32).regex(/^[A-Za-z0-9_-]+$/);
export const moneyMinorSchema = z.number().int().nonnegative();
export const usernameSchema = z.string().min(3).max(30).regex(/^[a-z0-9_]+$/);
export const passwordSchema = z.string().min(12).max(128).refine(
  (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value),
  'Password must include lowercase, uppercase, and a number',
);
export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) });
export const registrationSchema = z.object({ username: usernameSchema, password: passwordSchema });
