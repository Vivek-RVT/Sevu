export type PlanId = "starter" | "growth" | "pro";

export interface PlanLimits {
  maxPosts: number;
  maxCompletionsPerDay: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: { maxPosts: 10, maxCompletionsPerDay: 5 },
  growth:  { maxPosts: 15, maxCompletionsPerDay: 15 },
  pro:     { maxPosts: 20, maxCompletionsPerDay: 30 },
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  const p = (plan ?? "starter") as PlanId;
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.starter;
}
