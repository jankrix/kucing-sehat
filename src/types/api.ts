import { z } from "zod";

// Cat endpoints
export const CreateCatSchema = z.object({
  name: z.string().min(1).max(100),
  breed: z.string().max(100).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => new Date(d) <= new Date(),
    { message: "Tanggal lahir tidak boleh di masa depan" }
  ).optional(),
  gender: z.enum(["male", "female", "unknown"]).optional(),
  weight_kg: z.number().positive().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateCatSchema = CreateCatSchema.partial();

export type CreateCatInput = z.infer<typeof CreateCatSchema>;
export type UpdateCatInput = z.infer<typeof UpdateCatSchema>;

// Lab endpoints
export const UploadLabSchema = z.object({
  image: z.string().min(1), // base64 data URL
  test_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lab_name: z.string().max(200).optional(),
  vet_visit_id: z.string().uuid().optional(),
});

export const ConfirmLabSchema = z.object({
  values: z.array(
    z.object({
      parameter_name: z.string().min(1),
      parameter_label: z.string().optional(),
      value: z.number(),
      unit: z.string().min(1),
      ref_min: z.number().optional(),
      ref_max: z.number().optional(),
    })
  ),
});

export type UploadLabInput = z.infer<typeof UploadLabSchema>;
export type ConfirmLabInput = z.infer<typeof ConfirmLabSchema>;

// Chat endpoint
export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  image: z.string().optional(),
  cat_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
});

export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;

// Purchase log endpoints
export const CreatePurchaseSchema = z.object({
  category: z.enum(["food", "vitamin", "medicine", "supplement", "other"]),
  product_name: z.string().min(1).max(200),
  brand: z.string().max(200).optional(),
  quantity: z.string().max(100).optional(),
  price_idr: z.number().int().positive().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
});

export type CreatePurchaseInput = z.infer<typeof CreatePurchaseSchema>;
