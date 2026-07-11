import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
  remember: z.boolean().default(true)
});

export const customerSchema = z.object({
  company_name: z.string().min(2, "Firma adı gerekli."),
  contact_name: z.string().optional(),
  country: z.string().optional(),
  email: z.string().email("Geçerli e-posta girin.").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  notes: z.string().optional(),
  next_follow_up_at: z.string().optional()
});

export const orderLineSchema = z.object({
  product_id: z.string().optional(),
  barcode: z.string().optional(),
  product_name: z.string().min(1, "Ürün seçin."),
  quantity: z.coerce.number().min(0),
  cartons: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  discount_rate: z.coerce.number().min(0).max(100).default(0),
  vat_rate: z.coerce.number().min(0).max(100).default(0)
});

export const orderSchema = z.object({
  customer_id: z.string().min(1, "Müşteri seçin."),
  warehouse: z.string().optional(),
  currency: z.enum(["TRY", "USD", "EUR", "GEL", "RUB"]).default("USD"),
  exchange_rate: z.coerce.number().min(0).default(1),
  due_date: z.string().optional(),
  shipment_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(orderLineSchema).min(1, "En az bir ürün satırı gerekli.")
});

export type SignInValues = z.infer<typeof signInSchema>;
export type CustomerValues = z.infer<typeof customerSchema>;
export type OrderValues = z.infer<typeof orderSchema>;
