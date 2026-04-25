import { useLocation } from "wouter";
import { Sparkles, ArrowRight } from "lucide-react";
import { useGetBusiness } from "@workspace/api-client-react";
import { useBusinessId } from "@/lib/store";
import { PlanPicker } from "./upgrade";

export default function ChoosePlan() {
  const [, setLocation] = useLocation();
  const { businessId } = useBusinessId();
  const { data: business } = useGetBusiness(businessId!, {
    query: { enabled: !!businessId, staleTime: 0, refetchOnMount: "always" },
  });
  const currentPlan = (business as any)?.plan ?? "starter";

  const goToDashboard = () => setLocation("/app/dashboard");

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-display font-bold text-lg leading-tight">Pick your plan</h1>
          </div>
          <button
            type="button"
            onClick={goToDashboard}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full transition"
            data-testid="button-skip-plan"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Welcome blurb */}
      <div className="mx-4 mt-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-3">
        <p className="text-[13px] font-bold text-foreground leading-snug">
          Welcome to Sevu! 🎉
        </p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
          Choose a plan to unlock features for your business. You can change anytime from Settings.
        </p>
      </div>

      {/* Plans */}
      <PlanPicker
        currentPlan={currentPlan}
        onSelected={() => goToDashboard()}
        ctaLabel={(p) => (p.id === "starter" ? "Continue with Starter" : `Choose ${p.name}`)}
      />

      {/* Bottom CTA — continue with whatever plan is currently active */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-xl border-t border-border/50 px-4 py-3 z-20">
        <button
          type="button"
          onClick={goToDashboard}
          className="w-full py-3.5 rounded-xl bg-foreground text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
          data-testid="button-continue-dashboard"
        >
          Continue to Dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
