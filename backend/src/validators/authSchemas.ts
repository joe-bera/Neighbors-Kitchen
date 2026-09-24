import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254));

const name = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(50, `${label} must be 50 characters or less`);

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or less')
    .regex(/[A-Za-z]/, 'Password must include a letter')
    .regex(/[0-9]/, 'Password must include a number'),
  firstName: name('First name'),
  lastName: name('Last name'),
  role: z.enum(['CUSTOMER', 'CHEF'], 'Choose either customer or chef').default('CUSTOMER'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
