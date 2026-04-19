import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

export const clientSchema = z.object({
  fullName: z.string().min(1, 'El nombre es requerido'),
  businessName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const proveedorSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const materialCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  seccion: z.enum(['CORTES', 'CANTO', 'HERRAJES'], { required_error: 'La sección es requerida' }),
})

export const materialSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  internalCode: z.string().optional(),
  categoryId: z.string().min(1, 'La categoría es requerida'),
  proveedorId: z.string().optional(),
  unitId: z.string().min(1, 'La unidad es requerida'),
  unitCost: z.coerce.number().min(0, 'El costo debe ser positivo'),
  stock: z.coerce.number().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const furnitureTypeSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const bulkPriceUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre del lote es requerido'),
  percentage: z.coerce.number().min(0.01, 'El porcentaje debe ser mayor a 0'),
  scopeType: z.enum(['ALL', 'CATEGORY']),
  categoryId: z.string().optional(),
})

export const quoteItemEdgeBandSchema = z.object({
  materialId: z.string().optional(),
  side: z.enum(['TOP', 'BOTTOM', 'LEFT', 'RIGHT']),
  quantity: z.coerce.number().min(1).default(1),
})

export const quoteItemCutSchema = z.object({
  materialId: z.string().optional(),
  description: z.string().optional(),
  width: z.coerce.number().min(1, 'El ancho es requerido'),
  height: z.coerce.number().min(1, 'El alto es requerido'),
  quantity: z.coerce.number().min(1).default(1),
  notes: z.string().optional(),
  edgeBandMaterialId: z.string().optional(),
  edgeBands: z.array(quoteItemEdgeBandSchema).default([]),
})

export const quoteItemAccessorySchema = z.object({
  materialId: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1).default(1),
})

export const quoteItemSchema = z.object({
  furnitureTypeId: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1).default(1),
  notes: z.string().optional(),
  cuts: z.array(quoteItemCutSchema).default([]),
  accessories: z.array(quoteItemAccessorySchema).default([]),
})

export const quoteSchema = z.object({
  clientId: z.string().min(1, 'El cliente es requerido'),
  issueDate: z.string().min(1, 'La fecha es requerida'),
  expirationDate: z.string().optional().or(z.literal('')),
  laborPercentage: z.coerce.number().min(0).default(30),
  vatPercentage: z.coerce.number().min(0).default(21),
  discountAmount: z.coerce.number().min(0).default(0),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).optional().default([]),
})

export type ProveedorInput = z.infer<typeof proveedorSchema>
export type MaterialCategoryInput = z.infer<typeof materialCategorySchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ClientInput = z.infer<typeof clientSchema>
export type MaterialInput = z.infer<typeof materialSchema>
export type FurnitureTypeInput = z.infer<typeof furnitureTypeSchema>
export type BulkPriceUpdateInput = z.infer<typeof bulkPriceUpdateSchema>
export type QuoteInput = z.infer<typeof quoteSchema>
export type QuoteItemInput = z.infer<typeof quoteItemSchema>
export type QuoteItemCutInput = z.infer<typeof quoteItemCutSchema>
export type QuoteItemEdgeBandInput = z.infer<typeof quoteItemEdgeBandSchema>
export type QuoteItemAccessoryInput = z.infer<typeof quoteItemAccessorySchema>
