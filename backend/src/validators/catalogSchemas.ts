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

// Searching by distance: from a ZIP code, or from the browser's location (lat + lng).
const placeFields = {
  near: z.string().trim().regex(/^\d{5}$/, 'Enter a 5-digit ZIP code').optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistance: z.coerce.number().min(1, 'Use at least 1 mile').max(100, 'Use 100 miles or less').optional(),
};

type PlaceQuery = { near?: string; lat?: number; lng?: number };

function checkPlace(value: PlaceQuery, ctx: z.core.$RefinementCtx<PlaceQuery>) {
  if ((value.lat === undefined) !== (value.lng === undefined)) {
    ctx.addIssue({ code: 'custom', path: [value.lat === undefined ? 'lat' : 'lng'], message: 'Send both lat and lng' });
  }
  if (value.near !== undefined && value.lat !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['near'], message: 'Search from a ZIP code or a location, not both' });
  }
}

const chefFilters = {
  search: optionalText,
  city: optionalText,
  cuisine: optionalText,
};

export const chefListQuerySchema = z.object({ ...chefFilters, ...placeFields, ...pagination }).superRefine(checkPlace);

/** The map shows every matching chef, so it has no pages. */
export const chefMapQuerySchema = z.object({ ...chefFilters, ...placeFields }).superRefine(checkPlace);

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
export type ChefMapQuery = z.infer<typeof chefMapQuerySchema>;
export type MealListQuery = z.infer<typeof mealListQuerySchema>;
