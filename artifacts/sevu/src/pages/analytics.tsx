import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useBusinessId } from "@/lib/store";
import {
  Eye, Phone, MessageCircle, Star, TrendingUp,
  BarChart3, AlertCircle, Loader2, ExternalLink,
  ChevronRight, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

interface Analytics {
  id: number;
  name: string;
  service: string;
  city: string;
  slug: string;
  rating: number;
  totalReviews: number;
  totalJobs: number;
  viewCount: number;
  callClicks: number;
  whatsappClicks: number;
  reviews: {
    id: number;
    reviewerName: string;
    rating: number;
    comment?: string;
    createdAt: string;
  }[];
}

function StatCard({
  icon,
  label,
  value,
  color,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  sublabel?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 flex items-center gap-4 ${color}`}>
      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-display font-bold leading-tight">{value}</p>
        <p className="text-sm font-semibold opacity-80 mt-0.5">{label}</p>
        {sublabel && <p className="text-xs opacity-60 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function Analytics() {
  const { businessId } = useBusinessId();
  const [, setLocation] = useLocation();

  if (!businessId) return <Redirect to="/app/login" />;

  const { data: profiles, isLoading: loadingProfiles } = useQuery<any[]>({
    queryKey: ["my-profile", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/profiles?businessId=${businessId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    }
  });

  const myProfile = profiles?.[0];

  const { data: analytics, isLoading: loadingAnalytics } = useQuery<Analytics>({
    queryKey: ["analytics", myProfile?.slug],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${myProfile.slug}/analytics`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!myProfile?.slug,
  });

  const isLoading = loadingProfiles || loadingAnalytics;

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen">

        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-secondary text-white px-4 pt-5 pb-6">
          <h1 className="text-2xl font-display font-bold">Profile Analytics</h1>
          <p className="text-white/70 text-xs mt-0.5">Dekho kitne log aapko dhoondh rahe hain</p>
        </div>

        <div className="flex-1 px-4 pt-4 pb-28 space-y-4">
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            </div>
          )}

          {!isLoading && !myProfile && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-5">
                <BarChart3 className="w-10 h-10 text-primary/40" />
              </div>
              <h3 className="text-xl font-display font-bold mb-2">Profile nahi bana abhi tak</h3>
              <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed mb-6">
                Directory mein list hone ke liye apna public profile setup karo — phir yahan analytics dikhega
              </p>
              <button
                onClick={() => setLocation("/app/settings")}
                className="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all">
                <ChevronRight className="w-4 h-4" /> Settings mein jao
              </button>
            </div>
          )}

          {!isLoading && analytics && (
            <>
              {/* Profile link strip */}
              <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{analytics.name}</p>
                  <p className="text-xs text-muted-foreground">{analytics.service} · {analytics.city}</p>
                </div>
                <a
                  href={`/profile/${analytics.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-primary font-bold bg-primary/10 px-3 py-2 rounded-xl hover:bg-primary/20 transition-colors">
                  Public Profile <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Big 3 stats */}
              <div className="space-y-3">
                <StatCard
                  icon={<Eye className="w-6 h-6 text-white" />}
                  label="Profile Dekha"
                  value={analytics.viewCount}
                  color="bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  sublabel="Log aapka page dekh chuke hain"
                />
                <StatCard
                  icon={<MessageCircle className="w-6 h-6 text-white" />}
                  label="WhatsApp pe Aaye"
                  value={analytics.whatsappClicks}
                  color="bg-gradient-to-r from-[#25D366] to-[#1da851] text-white"
                  sublabel="Logo ne WhatsApp button dabaya"
                />
                <StatCard
                  icon={<Phone className="w-6 h-6 text-white" />}
                  label="Phone pe Click"
                  value={analytics.callClicks}
                  color="bg-gradient-to-r from-violet-500 to-violet-600 text-white"
                  sublabel="Logo ne call karne ki koshish ki"
                />
              </div>

              {/* Rating + Reviews strip */}
              <div className="bg-card border border-border/50 rounded-2xl p-4 grid grid-cols-3 divide-x divide-border/50">
                <div className="text-center pr-3">
                  <p className="text-2xl font-display font-bold text-amber-500">
                    {analytics.rating > 0 ? analytics.rating.toFixed(1) : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Rating</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-2xl font-display font-bold text-foreground">{analytics.totalReviews}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Reviews</p>
                </div>
                <div className="text-center pl-3">
                  <p className="text-2xl font-display font-bold text-foreground flex items-center justify-center gap-1">
                    {analytics.totalJobs}<CheckCircle2 className="w-4 h-4 text-primary" />
                  </p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Jobs Done</p>
                </div>
              </div>

              {/* Recent Reviews */}
              <div>
                <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  Nayi Reviews
                </h2>

                {analytics.reviews.length === 0 ? (
                  <div className="bg-card border border-dashed border-border/60 rounded-2xl py-10 text-center">
                    <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-foreground">Abhi tak koi review nahi</p>
                    <p className="text-sm text-muted-foreground mt-1">Customers se share karo apna profile link</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analytics.reviews.map(r => (
                      <div key={r.id} className="bg-card border border-border/50 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                              {r.reviewerName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{r.reviewerName}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(r.createdAt), "d MMM, yyyy")}
                              </p>
                            </div>
                          </div>
                          <StarRow rating={r.rating} />
                        </div>
                        {r.comment && (
                          <p className="text-sm text-foreground/80 leading-relaxed">{r.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tip */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 rounded-2xl px-4 py-3 flex gap-3 items-start">
                <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                  <span className="font-bold">Tip:</span> Har customer ko profile link bhejo WhatsApp pe — views aur reviews dono badhenge
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
