import { useLocation } from "wouter";
import { ArrowLeft, Check, X, Crown, Sparkles, Zap } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useGetBusiness } from "@workspace/api-client-react";
import { useBusinessId } from "@/lib/store";
import { PLANS, type PlanInfo } from "@/lib/plans";

const planAccent: Record<string, { ring: string; bg: string; text: string; btn: string; icon: any }> = {
  starter: { ring: "border-border",      bg: "bg-card",                                     text: "text-foreground",       btn: "bg-foreground text-background",                                  icon: Sparkles },
  growth:  { ring: "border-primary",     bg: "bg-gradient-to-br from-primary/5 to-secondary/5", text: "text-primary",          btn: "bg-primary text-white shadow-lg shadow-primary/30",              icon: Zap },
  pro:     { ring: "border-amber-400",   bg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/5", text: "text-amber-700 dark:text-amber-400", btn: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30", icon: Crown },
};

function PlanCard({ plan, currentPlan }: { plan: PlanInfo; currentPlan: string }) {
  const a = planAccent[plan.id];
  const Icon = a.icon;
  const isCurrent = plan.id === currentPlan;
  const off = Math.round(((plan.priceRegular - plan.priceLaunch) / plan.priceRegular) * 100);

  return (
    <div className={`relative rounded-3xl border-2 ${a.ring} ${a.bg} p-5 shadow-sm`}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
          Most Popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4 bg-secondary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
          Current
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${a.text}`} />
        <h3 className={`font-display font-bold text-xl ${a.text}`}>{plan.name}</h3>
      </div>

      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-3xl font-display font-extrabold text-foreground">₹{plan.priceLaunch}</span>
        <span className="text-sm text-muted-foreground">/month</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-muted-foreground line-through">₹{plan.priceRegular}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
          {off}% off launch
        </span>
      </div>

      <button
        disabled={isCurrent}
        className={`w-full mt-4 mb-5 py-3 rounded-xl font-bold text-sm transition active:scale-[0.98] ${isCurrent ? "bg-muted text-muted-foreground cursor-not-allowed" : a.btn + " hover:opacity-95"}`}
      >
        {isCurrent ? "Currently active" : `Upgrade to ${plan.name}`}
      </button>

      <div className="space-y-4">
        {plan.sections.map((sec) => (
          <div key={sec.title}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{sec.title}</p>
            <ul className="space-y-1.5">
              {sec.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                  {it.included
                    ? <Check className="w-4 h-4 text-secondary shrink-0 mt-0.5" strokeWidth={3} />
                    : <X     className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />}
                  <span className={it.included ? "text-foreground" : "text-muted-foreground/70 line-through"}>{it.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Upgrade() {
  const [, setLocation] = useLocation();
  const { businessId } = useBusinessId();
  const { data: business } = useGetBusiness(businessId!, {
    query: { enabled: !!businessId, staleTime: 0, refetchOnMount: "always" },
  });
  const currentPlan = (business as any)?.plan ?? "starter";

  return (
    <MobileLayout>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/50">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => history.length > 1 ? history.back() : setLocation("/app/analytics")}
              className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-90 transition"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight">Upgrade your plan</h1>
              <p className="text-[11px] text-muted-foreground">Aapke business ke liye behtar features</p>
            </div>
          </div>
        </div>

        {/* Launch banner */}
        <div className="mx-4 mt-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-foreground leading-snug">Launch Offer — 50% off</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Sirf shuruaati customers ke liye. Limited time.</p>
          </div>
        </div>

        {/* Plans */}
        <div className="px-4 mt-6 space-y-7">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} currentPlan={currentPlan} />
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-8 px-6">
          Plans WhatsApp / UPI ke through manually activate hote hain. Upgrade ke baad apke plan mein new features unlock ho jayenge.
        </p>
      </div>
    </MobileLayout>
  );
}
