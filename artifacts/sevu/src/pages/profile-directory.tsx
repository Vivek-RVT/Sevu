import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Star, ChevronRight, Loader2, Wrench, Zap, Scissors, ThermometerSnowflake, UserCircle2, LogIn, X, ShieldCheck, IndianRupee, SlidersHorizontal, Sparkles, Hammer, Droplets, Plus, FlaskConical } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";

interface ReviewerUser { name: string; phone?: string; }
function getReviewer(): ReviewerUser | null {
  try { return JSON.parse(localStorage.getItem("sevuReviewer") || "null"); }
  catch { return null; }
}
function saveReviewer(user: ReviewerUser) { localStorage.setItem("sevuReviewer", JSON.stringify(user)); }
function clearReviewer() { localStorage.removeItem("sevuReviewer"); }

export default function ProfileDirectory() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const activeService = searchParams.get("service") || "";
  const activeCity = searchParams.get("city") || "";
  const activeMinRating = searchParams.get("minRating") || "";

  const [service, setService] = useState(activeService);
  const [city, setCity] = useState(activeCity);
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(activeMinRating);

  const isSevu = !!localStorage.getItem("sevuBusinessId");
  const [reviewer, setReviewer] = useState<ReviewerUser | null>(() => getReviewer());
  const [showLoginBar, setShowLoginBar] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPhone, setLoginPhone] = useState("");

  useEffect(() => { setService(activeService); setCity(activeCity); setMinRating(activeMinRating); }, [activeService, activeCity, activeMinRating]);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles", activeService, activeCity, activeMinRating],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (activeService) params.append("service", activeService);
      if (activeCity) params.append("city", activeCity);
      const res = await fetch(`/api/profiles?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const data = await res.json();
      if (activeMinRating) {
        return data.filter((p: any) => (p.rating || 0) >= parseFloat(activeMinRating));
      }
      return data;
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (service) params.append("service", service);
    if (city) params.append("city", city);
    if (minRating) params.append("minRating", minRating);
    setLocation(`/profile?${params.toString()}`);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) return;
    const user: ReviewerUser = { name: loginName.trim(), phone: loginPhone.trim() || undefined };
    saveReviewer(user);
    setReviewer(user);
    setShowLoginBar(false);
    setLoginName(""); setLoginPhone("");
  };

  const categoryGroups = [
    {
      label: "🔥 Popular Services",
      items: [
        { name: "Plumber", icon: Wrench, color: "text-primary", bg: "bg-primary/10" },
        { name: "Electrician", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/10" },
        { name: "AC Repair", icon: ThermometerSnowflake, color: "text-cyan-500", bg: "bg-cyan-500/10" },
        { name: "Salon", icon: Scissors, color: "text-pink-500", bg: "bg-pink-500/10" },
      ],
    },
    {
      label: "🏠 Home Services",
      items: [
        { name: "Carpenter", icon: Hammer, color: "text-amber-700", bg: "bg-amber-700/10" },
        { name: "Home Cleaning", icon: Sparkles, color: "text-teal-500", bg: "bg-teal-500/10" },
        { name: "RO / Water Filter", icon: Droplets, color: "text-sky-500", bg: "bg-sky-500/10" },
      ],
    },
    {
      label: "🏥 Healthcare",
      items: [
        { name: "Lab / Diagnostics", icon: FlaskConical, color: "text-rose-600", bg: "bg-rose-600/10" },
      ],
    },
  ];

  const ratingFilters = [
    { label: "4.5+", value: "4.5" },
    { label: "4.0+", value: "4.0" },
    { label: "3.5+", value: "3.5" },
  ];

  const inner = (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Reviewer auth bar */}
      {!isSevu && !showLoginBar && (
        <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 ${reviewer ? "bg-primary/5 border-primary/10" : "bg-muted/40 border-border/50"}`}>
          {reviewer ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <UserCircle2 className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">{reviewer.name}</span>
                <span className="text-muted-foreground">· signed in</span>
              </div>
              <button onClick={() => { clearReviewer(); setReviewer(null); }}
                className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1 transition-colors">
                <X className="w-3.5 h-3.5" /> Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Sign in to leave reviews</p>
              <button onClick={() => setShowLoginBar(true)}
                className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors">
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </button>
            </>
          )}
        </div>
      )}

      {/* Inline login form */}
      {!isSevu && showLoginBar && (
        <div className="bg-card border-b border-border px-4 py-4 animate-in slide-in-from-top-2 duration-300">
          <form onSubmit={handleLogin} className="max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm">Sign In to Leave Reviews</h3>
              <button type="button" onClick={() => setShowLoginBar(false)} className="p-1 rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <input type="text" required placeholder="Your name" value={loginName} onChange={e => setLoginName(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm font-medium" />
              <input type="tel" placeholder="Phone (optional)" value={loginPhone} onChange={e => setLoginPhone(e.target.value)}
                className="w-32 px-3 py-2.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none text-sm font-medium" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" /> Continue
            </button>
            <p className="text-xs text-muted-foreground text-center">No password. Just your name, saved locally.</p>
          </form>
        </div>
      )}

      {/* Header & Search */}
      <div className="bg-primary/5 pt-10 pb-8 px-4 sm:px-6 lg:px-8 border-b border-primary/10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
              Find Trusted Local <span className="text-primary">Service Providers</span>
            </h1>
            <p className="text-muted-foreground text-lg">Browse verified professionals near you</p>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 bg-card p-2 rounded-2xl shadow-lg border border-border/50">
            <div className="flex-1 relative flex items-center">
              <Search className="w-5 h-5 absolute left-3 text-muted-foreground" />
              <input type="text" placeholder="Service (e.g. Plumber)" className="w-full bg-transparent border-none pl-10 pr-4 py-3 focus:outline-none text-foreground" value={service} onChange={e => setService(e.target.value)} />
            </div>
            <div className="hidden sm:block w-px bg-border my-2"></div>
            <div className="flex-1 relative flex items-center border-t sm:border-t-0 border-border/50">
              <MapPin className="w-5 h-5 absolute left-3 text-muted-foreground" />
              <input type="text" placeholder="City" className="w-full bg-transparent border-none pl-10 pr-4 py-3 focus:outline-none text-foreground" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="flex gap-2 sm:w-auto w-full">
              <button type="button" onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-semibold text-sm transition-colors ${showFilters || minRating ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                <SlidersHorizontal className="w-4 h-4" />
                {minRating ? `${minRating}+★` : "Filter"}
              </button>
              <button type="submit" className="flex-1 sm:flex-initial bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-md active:scale-95">Search</button>
            </div>
          </form>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground">Filter by Rating</p>
                {minRating && (
                  <button onClick={() => { setMinRating(""); }} className="text-xs text-primary font-semibold">Clear</button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {ratingFilters.map(f => (
                  <button key={f.value} onClick={() => setMinRating(minRating === f.value ? "" : f.value)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${minRating === f.value ? "bg-amber-400 text-white border-amber-400" : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"}`}>
                    <Star className="w-3.5 h-3.5 fill-current" />{f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Category Row */}
        <section>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scrollbar-hide">
            {categoryGroups.flatMap(g => g.items).map((cat) => {
              const isActive = activeService.toLowerCase() === cat.name.toLowerCase();
              return (
                <button key={cat.name}
                  onClick={() => setLocation(isActive ? "/profile" : `/profile?service=${encodeURIComponent(cat.name)}`)}
                  className={`flex flex-col items-center gap-2 flex-shrink-0 w-20 py-3 rounded-2xl border transition-all active:scale-95
                    ${isActive ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20" : "border-border/50 bg-card hover:shadow-sm hover:border-primary/30"}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cat.bg} ${cat.color} transition-transform`}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[11px] font-semibold text-center leading-tight px-1 ${isActive ? "text-primary" : "text-foreground"}`}>{cat.name}</span>
                </button>
              );
            })}
            {/* Other */}
            <button
              onClick={() => { setService(""); setLocation("/profile"); }}
              className="flex flex-col items-center gap-2 flex-shrink-0 w-20 py-3 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95">
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-semibold text-center leading-tight px-1 text-muted-foreground">Other</span>
            </button>
          </div>
        </section>

        {/* Results */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-xl font-display font-bold">
              {activeService ? `${activeService} Providers` : activeCity ? `Providers in ${activeCity}` : "Top Providers"}
            </h2>
            {profiles && <span className="text-sm text-muted-foreground">{profiles.length} results</span>}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
          ) : profiles?.length === 0 ? (
            <div className="text-center py-14 bg-card rounded-2xl border border-dashed border-border/60">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-lg text-foreground">No providers found nearby</h3>
              <p className="text-muted-foreground mt-1 text-sm max-w-xs mx-auto">
                {activeService || activeCity
                  ? `No ${activeService || "providers"} found${activeCity ? ` in ${activeCity}` : ""}. Try a different city or service.`
                  : "Try searching for a service type or city to find providers."}
              </p>
              {(activeService || activeCity) && (
                <button onClick={() => setLocation('/profile')} className="mt-4 text-primary font-semibold text-sm hover:underline">
                  ← Clear filters &amp; browse all
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {profiles?.map((profile: any) => (
                <div key={profile.id} onClick={() => setLocation(`/profile/${profile.slug}`)}
                  className="bg-card p-4 sm:p-5 rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex gap-4 items-start min-w-0">
                      {/* Avatar */}
                      <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xl uppercase shrink-0 overflow-hidden">
                        {profile.profileImage
                          ? <img src={profile.profileImage} alt={profile.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          : profile.name.charAt(0)}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Name + Verified badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors leading-tight">{profile.name}</h3>
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        </div>

                        {/* Service & City */}
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                          {profile.service} • <MapPin className="w-3 h-3 inline -mt-0.5" /> {profile.city}
                        </p>

                        {/* Rating row */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(profile.rating || 0) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                            ))}
                            <span className="font-bold text-sm ml-0.5">
                              {profile.rating ? profile.rating.toFixed(1) : "New"}
                            </span>
                            {profile.totalReviews > 0 && (
                              <span className="text-xs text-muted-foreground">({profile.totalReviews} reviews)</span>
                            )}
                          </div>

                          {/* Price range */}
                          {profile.priceRange && (
                            <span className="flex items-center gap-0.5 text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full font-semibold">
                              <IndianRupee className="w-3 h-3" />{profile.priceRange}
                            </span>
                          )}

                          {/* Jobs done */}
                          {profile.totalJobs > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {profile.totalJobs} jobs done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted p-2 rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="py-8 text-center border-t border-border/50 mt-auto bg-card">
        <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
          Powered by <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Sevu" className="w-5 h-5 rounded" /> <span className="font-display font-bold text-foreground">Sevu</span>
        </p>
      </footer>
    </div>
  );

  if (isSevu) return <MobileLayout>{inner}</MobileLayout>;
  return inner;
}
