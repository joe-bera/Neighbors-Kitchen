import { z } from 'zod';

const shortList = (label: string, max: number, itemMax: number) =>
  z
    .array(z.string().trim().min(2, `Each ${label} needs at least 2 characters`).max(itemMax))
    .max(max, `Choose up to ${max} ${label}s`)
    // Drop repeats, ignoring capitalization.
    .transform((items) => items.filter((item, index) => items.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index));

// The fields a chef fills in about their kitchen. No defaults here, so partial updates leave other fields alone.
const kitchenFields = {
  kitchenName: z.string().trim().min(2, 'Kitchen name needs at least 2 characters').max(60, 'Use 60 characters or less'),
  bio: z
    .string()
    .trim()
    .min(20, 'Tell neighbors a little more about your cooking (at least 20 characters)')
    .max(1000, 'Use 1,000 characters or less'),
  specialties: shortList('specialty', 5, 30).refine((items) => items.length > 0, 'Add at least one specialty'),
  yearsExperience: z.number().int().min(0).max(70).nullish().transform((value) => value ?? null),
  certifications: shortList('certification', 5, 80),
  addressLine1: z.string().trim().min(3, 'Enter your street address').max(100),
  addressLine2: z.string().trim().max(100).nullish().transform((value) => value || null),
  city: z.string().trim().min(2, 'Enter your city').max(60),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use the 2-letter state code, like CA'),
  zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
  serviceRadiusMiles: z.number().min(1, 'Serve at least 1 mile').max(50, 'Serve 50 miles or less'),
};

export const kitchenProfileSchema = z.object({
  ...kitchenFields,
  certifications: kitchenFields.certifications.default([]),
  serviceRadiusMiles: kitchenFields.serviceRadiusMiles.default(5),
});

export const kitchenUpdateSchema = z
  .object({ ...kitchenFields, isAcceptingOrders: z.boolean() })
  .partial();

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 17:00');

export const availabilitySchema = z
  .object({
    schedule: z
      .array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: clockTime,
          endTime: clockTime,
        }),
      )
      .max(7),
    orderLeadTimeHours: z.number().int().min(1, 'Use at least 1 hour').max(168, 'Use 7 days (168 hours) or less'),
    offersPickup: z.boolean(),
    offersDelivery: z.boolean(),
    deliveryFee: z.number().min(0).max(50, 'Delivery fee must be $50 or less').default(0),
  })
  .superRefine((value, ctx) => {
    const days = new Set<number>();
    value.schedule.forEach((window, index) => {
      if (window.endTime <= window.startTime) {
        ctx.addIssue({ code: 'custom', path: ['schedule', index, 'endTime'], message: 'End time must be after start time' });
      }
      if (days.has(window.dayOfWeek)) {
        ctx.addIssue({ code: 'custom', path: ['schedule', index, 'dayOfWeek'], message: 'Each day can only be listed once' });
      }
      days.add(window.dayOfWeek);
    });
    if (!value.offersPickup && !value.offersDelivery) {
      ctx.addIssue({ code: 'custom', path: ['offersPickup'], message: 'Offer pickup, delivery, or both' });
    }
  });

export type KitchenProfileInput = z.infer<typeof kitchenProfileSchema>;
export type KitchenUpdateInput = z.infer<typeof kitchenUpdateSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
