import { z } from 'zod';

export const uuidSchema = z.uuid();
export const currencySchema = z.string().regex(/^[A-Z]{3}$/u);
export const moneySchema = z.object({
  amount: z.string().regex(/^-?\d{1,15}(\.\d{1,4})?$/u),
  currency: currencySchema,
});
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type MoneyInput = z.infer<typeof moneySchema>;
