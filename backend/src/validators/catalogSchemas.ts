import { MealCategory } from '@prisma/client';
import { z } from 'zod';

/** Optional text filter: trimmed, and treated as absent when empty. */
const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => value || undefined);

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50, 'Limit must be 50 or less').default(12),
};

export const chefListQuerySchema = z.object({
  search: optionalText,
  city: optionalText,
  cuisine: optionalText,
  ...pagination,
});

/** Accepts `?dietary=vegan,gluten-free` or repeated `?dietary=vegan&dietary=gluten-free`. */
const dietaryTags = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) =>
    [value ?? []]
      .flat()
      .flatMap((entry) => entry.split(','))
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  );

export const mealSortOptions = ['recommended', 'price_asc', 'price_desc', 'newest'] as const;

export const mealListQuerySchema = z.object({
  search: optionalText,
  category: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(MealCategory, 'Choose breakfast, lunch, dinner, dessert or snack'))
    .optional(),
  cuisine: optionalText,
  dietary: dietaryTags,
  maxPrice: z.coerce.number().positive().optional(),
  chefId: optionalText,
  sort: z.enum(mealSortOptions).default('recommended'),
  ...pagination,
});

export type ChefListQuery = z.infer<typeof chefListQuerySchema>;
export type MealListQuery = z.infer<typeof mealListQuerySchema>;
