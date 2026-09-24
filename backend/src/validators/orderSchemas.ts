import { z } from 'zod';

const digitCount = (value: string) => value.replace(/\D/g, '').length;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or less`)
    .nullish()
    .transform((value) => value || null);

export const placeOrderSchema = z
  .object({
    chefId: z.string().min(1),
    items: z
      .array(
        z.object({
          mealId: z.string().min(1),
          quantity: z.number().int().min(1, 'Order at least 1').max(20, 'Order 20 or fewer'),
        }),
      )
      .min(1, 'Add at least one meal')
      .max(30)
      .refine((items) => new Set(items.map((item) => item.mealId)).size === items.length, 'Each meal can only be listed once'),
    pickupOrDelivery: z.enum(['PICKUP', 'DELIVERY'], 'Choose pickup or delivery'),
    scheduledFor: z.iso.datetime({ offset: true, message: 'Choose a time' }).transform((value) => new Date(value)),
    deliveryAddress: optionalText(300),
    contactPhone: optionalText(30).refine(
      (phone) => phone === null || (digitCount(phone) >= 10 && digitCount(phone) <= 15),
      'Enter a phone number with area code',
    ),
    specialInstructions: optionalText(500),
  })
  .superRefine((order, ctx) => {
    if (order.pickupOrDelivery !== 'DELIVERY') return;
    if (!order.deliveryAddress || order.deliveryAddress.length < 5) {
      ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Enter the delivery address' });
    }
    if (!order.contactPhone) {
      ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: 'Enter a phone number so the chef can reach you' });
    }
  });

export const cancelOrderSchema = z.object({
  reason: optionalText(300),
});

export const orderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'], 'Unknown order status'),
});

export const orderListQuerySchema = z.object({
  view: z.enum(['active', 'past']).optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
