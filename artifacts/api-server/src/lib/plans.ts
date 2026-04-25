export type PlanId = "starter" | "growth" | "pro";

export interface PlanLimits {
  maxPosts: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: { maxPosts: 10 },
  growth:  { maxPosts: 15 },
  pro:     { maxPosts: 20 },
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  const p = (plan ?? "starter") as PlanId;
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.starter;
}
