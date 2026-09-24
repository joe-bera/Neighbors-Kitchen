import { MealCategory } from '@prisma/client';
import { z } from 'zod';

export const DIETARY_TAGS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'contains-nuts',
  'halal',
  'kosher',
  'spicy',
] as const;

const roundToCents = (value: number) => Math.round(value * 100) / 100;

// No defaults here, so partial updates leave other fields alone.
const mealFields = {
  name: z.string().trim().min(2, 'Enter a meal name').max(80, 'Use 80 characters or less'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the meal in at least 10 characters')
    .max(1000, 'Use 1,000 characters or less'),
  price: z.number('Enter a price').min(1, 'Price must be at least $1').max(500, 'Price must be $500 or less').transform(roundToCents),
  category: z.enum(MealCategory, 'Choose breakfast, lunch, dinner, dessert or snack'),
  cuisineType: z.string().trim().max(40).nullish().transform((value) => value || null),
  dietaryTags: z
    .array(z.enum(DIETARY_TAGS, 'Unknown dietary tag'))
    .transform((tags) => [...new Set(tags)]),
  servings: z.number().int().min(1, 'Serves at least 1').max(20, 'Serves 20 or fewer'),
  prepTimeMinutes: z.number().int().min(5, 'Prep time must be at least 5 minutes').max(600, 'Prep time must be 10 hours or less'),
  maxOrdersPerDay: z.number().int().min(1).max(500).nullish().transform((value) => value ?? null),
  isAvailable: z.boolean(),
  imageUrl: z.string().trim().max(500).nullish().transform((value) => value || null),
};

export const mealCreateSchema = z.object({
  ...mealFields,
  dietaryTags: mealFields.dietaryTags.default([]),
  isAvailable: mealFields.isAvailable.default(true),
});

export const mealUpdateSchema = z.object(mealFields).partial();

export type MealCreateInput = z.infer<typeof mealCreateSchema>;
export type MealUpdateInput = z.infer<typeof mealUpdateSchema>;
