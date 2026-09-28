import { z } from "zod";

export const SaaSPlanSchema = z.enum(["FREE", "PRO"]);
export type SaaSPlan = z.infer<typeof SaaSPlanSchema>;

export const SaaSConfigSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().min(1),
  freeQrLimit: z.number().int().positive(),
  proQrLimit: z.number().int().positive()
});

export type SaaSConfig = z.infer<typeof SaaSConfigSchema>;

export const WorkspaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  plan: SaaSPlanSchema.default("FREE")
});

export const WorkspaceQrRecordSchema = z.object({
  recordId: z.string().trim().min(1).max(128),
  type: z.string().trim().min(1).max(32),
  payload: z.string().min(1).max(2048),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().default(0),
  isFavorite: z.boolean(),
  foregroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  marginModules: z.number().int().min(1).max(8)
});

export type Workspace = {
  id: string;
  name: string;
  plan: SaaSPlan;
  createdAt: number;
  ownerUserId?: string | null;
};

export type WorkspaceQrRecord = z.infer<typeof WorkspaceQrRecordSchema> & {
  workspaceId: string;
};
