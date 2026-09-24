import { z } from 'zod';
import { DIETARY_TAGS } from './mealSchemas.js';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or less`)
    .nullish()
    .transform((value) => value || null);

export const createReviewSchema = z.object({
  orderId: z.string().min(1),
  mealId: z.string().min(1),
  rating: z.number('Choose a rating').int('Choose from 1 to 5 stars').min(1, 'Choose from 1 to 5 stars').max(5, 'Choose from 1 to 5 stars'),
  comment: optionalText(1000),
});

export const reviewResponseSchema = z.object({
  response: z.string().trim().min(2, 'Write a short reply').max(1000, 'Use 1,000 characters or less'),
});

export const reportReviewSchema = z.object({
  reason: optionalText(300),
});

export const suggestionSchema = z.object({
  mealName: z.string().trim().min(2, 'Name the dish you would like').max(80, 'Use 80 characters or less'),
  description: z
    .string()
    .trim()
    .min(10, 'Tell the chef a little more (at least 10 characters)')
    .max(500, 'Use 500 characters or less'),
  dietaryRequirements: z
    .array(z.enum(DIETARY_TAGS, 'Unknown dietary need'))
    .default([])
    .transform((tags) => [...new Set(tags)]),
});

export const suggestionUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONSIDERING', 'ACCEPTED', 'DECLINED'], 'Unknown status'),
  chefResponse: optionalText(500),
});

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type SuggestionInput = z.infer<typeof suggestionSchema>;
export type SuggestionUpdateInput = z.infer<typeof suggestionUpdateSchema>;
