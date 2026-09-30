import { z } from 'zod';

export const emailSettingsSchema = z
  .object({ rateReminders: z.boolean(), dishRequestNews: z.boolean(), kitchenFeedback: z.boolean() })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Choose a setting to change');

export type EmailSettingsInput = z.infer<typeof emailSettingsSchema>;
