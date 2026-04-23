import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useBusinessId } from "@/lib/store";
import { useUpload } from "@workspace/object-storage-web";
import {
  Eye, Phone, MessageCircle, Star, TrendingUp,
  BarChart3, Loader2, ExternalLink,
  ChevronRight, CheckCircle2, Camera, Pencil, X, Save,
  MapPin, Clock, Globe, Instagram, BadgeCheck, Wrench,
  IndianRupee, Image as ImageIcon, Sparkles,
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

async function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = document.createElement("img") as HTMLImageElement;
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        const r = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      c.toBlob(b => {
        if (!b) return resolve(file);
        const f = new File([b], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        resolve(f.size < file.size ? f : file);
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const toPublicUrl = (objectPath: string) =>
  `/api/storage/profile-objects${objectPath.replace(/^\/objects/, "")}`;

function StatCard({
  icon, label, value, color, sublabel,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  color: string; sublabel?: string;
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
        <Star key={s}
          className={`w-4 h-4 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

const inp = "w-full px-3.5 py-3 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm font-medium placeholder:text-muted-foreground/50";

export default function Analytics() {
  const { businessId } = useBusinessId();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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
  const slug = myProfile?.slug as string | undefined;

  const { data: analytics, isLoading: loadingAnalytics } = useQuery<Analytics>({
    queryKey: ["analytics", slug],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${slug}/analytics`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!slug,
  });

  const isLoading = loadingProfiles || loadingAnalytics;

  // ── Edit modal state ──────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    description: "", servicesOffered: "", priceRange: "", openingHours: "",
    yearsExperience: "", whatsapp: "", website: "", instagram: "",
    city: "", address: "",
  });

  useEffect(() => {
    if (!myProfile) return;
    setForm({
      description: myProfile.description || "",
      servicesOffered: myProfile.servicesOffered || "",
      priceRange: myProfile.priceRange || "",
      openingHours: myProfile.openingHours || "",
      yearsExperience: myProfile.yearsExperience?.toString() || "",
      whatsapp: myProfile.whatsapp || "",
      website: myProfile.website || "",
      instagram: myProfile.instagram || "",
      city: myProfile.city || "",
      address: myProfile.address || "",
    });
  }, [myProfile]);

  const patchProfile = async (fields: Record<string, unknown>) => {
    if (!slug) return;
    await fetch(`/api/profiles/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    queryClient.invalidateQueries({ queryKey: ["my-profile", businessId] });
    queryClient.invalidateQueries({ queryKey: ["profile", slug] });
    queryClient.invalidateQueries({ queryKey: ["analytics", slug] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchProfile({
        ...form,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : null,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); }, 800);
    } finally {
      setSaving(false);
    }
  };

  // ── Image uploads ─────────────────────────────────────────────
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingShop, setUploadingShop] = useState(false);
  const profileInput = useRef<HTMLInputElement>(null);
  const shopInput = useRef<HTMLInputElement>(null);

  const saveImageRecord = (objectPath: string, type: string) =>
    fetch("/api/storage/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectPath, type, isPublic: true }),
    }).catch(() => {});

  const profileUpload = useUpload({
    onSuccess: async (res) => {
      const url = toPublicUrl(res.objectPath);
      saveImageRecord(res.objectPath, "profile");
      await patchProfile({ profileImage: url });
      setUploadingProfile(false);
    },
    onError: () => setUploadingProfile(false),
  });

  const shopUpload = useUpload({
    onSuccess: async (res) => {
      const url = toPublicUrl(res.objectPath);
      saveImageRecord(res.objectPath, "shop");
      await patchProfile({ shopImage: url });
      setUploadingShop(false);
    },
    onError: () => setUploadingShop(false),
  });

  const handleProfilePic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingProfile(true);
    const compressed = await compressImage(file, 800, 0.85);
    await profileUpload.uploadFile(compressed);
  };

  const handleShopPic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingShop(true);
    const compressed = await compressImage(file, 1200, 0.85);
    await shopUpload.uploadFile(compressed);
  };

  // Derived
  const services: string[] = myProfile?.servicesOffered
    ? myProfile.servicesOffered.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen pb-28">

        {isLoading && (
          <div className="flex-1 flex justify-center items-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
          </div>
        )}

        {!isLoading && !myProfile && (
          <>
            <div className="bg-gradient-to-br from-primary to-secondary text-white px-4 pt-5 pb-6">
              <h1 className="text-2xl font-display font-bold">Profile Analytics</h1>
              <p className="text-white/70 text-xs mt-0.5">Dekho kitne log aapko dhoondh rahe hain</p>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-5">
                <BarChart3 className="w-10 h-10 text-primary/40" />
              </div>
              <h3 className="text-xl font-display font-bold mb-2">Profile nahi bana abhi tak</h3>
              <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed mb-6">
                Directory mein list hone ke liye apna public profile setup karo — phir yahan analytics dikhega
              </p>
              <button onClick={() => setLocation("/app/settings")}
                className="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all">
                <ChevronRight className="w-4 h-4" /> Settings mein jao
              </button>
            </div>
          </>
        )}

        {!isLoading && myProfile && analytics && (
          <>
            {/* ── BANNER + LOGO HEADER ─────────────────────── */}
            <div className="relative">
              {/* Banner */}
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-primary via-purple-500 to-secondary">
                {myProfile.shopImage ? (
                  <img src={myProfile.shopImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: "radial-gradient(circle at 25% 30%, white 1.5px, transparent 1.5px)",
                    backgroundSize: "24px 24px",
                  }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                {/* Banner edit btn */}
                <button onClick={() => shopInput.current?.click()} disabled={uploadingShop}
                  className="absolute top-3 right-3 bg-black/55 hover:bg-black/75 backdrop-blur-md text-white text-xs font-bold px-3 py-2 rounded-full flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60">
                  {uploadingShop
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                    : <><Camera className="w-3.5 h-3.5" /> {myProfile.shopImage ? "Change" : "Add"} banner</>}
                </button>
                <input ref={shopInput} type="file" accept="image/*" hidden onChange={handleShopPic} />
              </div>

              {/* Logo + Edit */}
              <div className="px-4 -mt-12 relative z-10 flex items-end justify-between gap-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-background bg-card shadow-lg">
                    {myProfile.profileImage ? (
                      <img src={myProfile.profileImage} alt={myProfile.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary font-display font-bold text-3xl">
                        {(myProfile.name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <button onClick={() => profileInput.current?.click()} disabled={uploadingProfile}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition disabled:opacity-60">
                    {uploadingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                  <input ref={profileInput} type="file" accept="image/*" hidden onChange={handleProfilePic} />
                </div>

                <button onClick={() => setEditing(true)}
                  className="mb-2 flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md active:scale-95 hover:shadow-lg hover:shadow-primary/25 transition-all">
                  <Pencil className="w-3.5 h-3.5" /> Edit Profile
                </button>
              </div>

              {/* Name + meta */}
              <div className="px-4 mt-3">
                <h1 className="text-xl font-display font-bold leading-tight">{myProfile.name}</h1>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-sm text-muted-foreground font-semibold">{myProfile.service}</span>
                  {myProfile.city && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{myProfile.city}
                      </span>
                    </>
                  )}
                  {myProfile.yearsExperience && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5" />{myProfile.yearsExperience}+ yrs
                      </span>
                    </>
                  )}
                </div>

                {/* Quick rating chips */}
                <div className="flex items-center gap-3 mt-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-bold">{analytics.rating > 0 ? analytics.rating.toFixed(1) : "—"}</span>
                    <span className="text-muted-foreground">({analytics.totalReviews})</span>
                  </div>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />{analytics.totalJobs} jobs
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground font-semibold flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />{analytics.viewCount} views
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-4 pt-5 space-y-4">

              {/* Public link */}
              <a href={`/profile/${analytics.slug}`} target="_blank" rel="noopener noreferrer"
                className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 hover:from-primary/15 hover:to-secondary/15 active:scale-[0.99] transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs">View Public Profile</p>
                    <p className="text-[11px] text-muted-foreground truncate">/profile/{analytics.slug}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
              </a>

              {/* ── ANALYTICS SECTION ── */}
              <div>
                <h2 className="font-display font-bold text-base mb-2 px-1 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Engagement
                </h2>
                <div className="space-y-3">
                  <StatCard icon={<Eye className="w-6 h-6 text-white" />}
                    label="Profile Dekha" value={analytics.viewCount}
                    color="bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                    sublabel="Log aapka page dekh chuke hain" />
                  <StatCard icon={<MessageCircle className="w-6 h-6 text-white" />}
                    label="WhatsApp pe Aaye" value={analytics.whatsappClicks}
                    color="bg-gradient-to-r from-[#25D366] to-[#1da851] text-white"
                    sublabel="WhatsApp button dabaya" />
                  <StatCard icon={<Phone className="w-6 h-6 text-white" />}
                    label="Phone pe Click" value={analytics.callClicks}
                    color="bg-gradient-to-r from-violet-500 to-violet-600 text-white"
                    sublabel="Call karne ki koshish ki" />
                </div>
              </div>

              {/* ── ABOUT ── */}
              {myProfile.description ? (
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">About</p>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{myProfile.description}</p>
                </div>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="w-full bg-card border border-dashed border-border rounded-2xl p-4 text-left hover:border-primary/40 transition">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">About</p>
                  <p className="text-sm text-muted-foreground/70 italic mt-1">+ Add a description so customers know you better</p>
                </button>
              )}

              {/* ── SERVICES ── */}
              {services.length > 0 ? (
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3 h-3" /> Services Offered
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s, i) => (
                      <span key={i} className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="w-full bg-card border border-dashed border-border rounded-2xl p-4 text-left hover:border-primary/40 transition">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Services Offered</p>
                  <p className="text-sm text-muted-foreground/70 italic mt-1">+ List the services you offer</p>
                </button>
              )}

              {/* ── HOURS / PRICING ── */}
              {(myProfile.openingHours || myProfile.priceRange) && (
                <div className="grid grid-cols-2 gap-3">
                  {myProfile.openingHours && (
                    <div className="bg-card border border-border/50 rounded-2xl p-3.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hours</p>
                      </div>
                      <p className="text-sm font-semibold leading-tight">{myProfile.openingHours}</p>
                    </div>
                  )}
                  {myProfile.priceRange && (
                    <div className="bg-card border border-border/50 rounded-2xl p-3.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <IndianRupee className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Price Range</p>
                      </div>
                      <p className="text-sm font-semibold leading-tight">{myProfile.priceRange}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── CONTACT ── */}
              {(myProfile.whatsapp || myProfile.website || myProfile.instagram || myProfile.address) && (
                <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Contact</p>
                  {myProfile.whatsapp && (
                    <div className="flex items-center gap-2.5">
                      <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium">{myProfile.whatsapp}</span>
                    </div>
                  )}
                  {myProfile.website && (
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{myProfile.website}</span>
                    </div>
                  )}
                  {myProfile.instagram && (
                    <div className="flex items-center gap-2.5">
                      <Instagram className="w-4 h-4 text-pink-600 flex-shrink-0" />
                      <span className="text-sm font-medium">@{myProfile.instagram.replace(/^@/, "")}</span>
                    </div>
                  )}
                  {myProfile.address && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-medium leading-snug">{myProfile.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── WORK GALLERY (preview) ── */}
              {myProfile.workImages && myProfile.workImages.length > 0 && (
                <div className="bg-card border border-border/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3" /> Work Photos ({myProfile.workImages.length})
                    </p>
                    <button onClick={() => setLocation("/app/settings")} className="text-[11px] font-bold text-primary">
                      Manage →
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {myProfile.workImages.slice(0, 8).map((url: string, i: number) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── REVIEWS ── */}
              <div>
                <h2 className="font-display font-bold text-base mb-2 px-1 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Recent Reviews
                </h2>

                {analytics.reviews.length === 0 ? (
                  <div className="bg-card border border-dashed border-border/60 rounded-2xl py-8 text-center">
                    <Star className="w-9 h-9 text-muted-foreground mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-sm text-foreground">Abhi tak koi review nahi</p>
                    <p className="text-xs text-muted-foreground mt-1">Customers ko apna profile link bhejo</p>
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
            </div>
          </>
        )}
      </div>

      {/* ── EDIT PROFILE MODAL ─────────────────────────────────── */}
      {editing && myProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150"
          onClick={() => !saving && setEditing(false)}>
          <div className="bg-card w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-border/50 max-h-[92vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg">Edit Profile</h2>
                <p className="text-xs text-muted-foreground">Public profile pe ye dikhega</p>
              </div>
              <button onClick={() => !saving && setEditing(false)} disabled={saving}
                className="w-9 h-9 rounded-full hover:bg-muted active:scale-95 flex items-center justify-center transition disabled:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Description</label>
                <textarea rows={3} className={inp}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Apna kaam ke baare mein batao..." />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Services Offered</label>
                <textarea rows={2} className={inp}
                  value={form.servicesOffered}
                  onChange={e => setForm({ ...form, servicesOffered: e.target.value })}
                  placeholder="Comma se separate karo: Service 1, Service 2..." />
                <p className="text-[10px] text-muted-foreground mt-1">Comma separated</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">Years Experience</label>
                  <input type="number" min={0} className={inp}
                    value={form.yearsExperience}
                    onChange={e => setForm({ ...form, yearsExperience: e.target.value })}
                    placeholder="5" />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">Price Range</label>
                  <input type="text" className={inp}
                    value={form.priceRange}
                    onChange={e => setForm({ ...form, priceRange: e.target.value })}
                    placeholder="₹500 – ₹2000" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Opening Hours</label>
                <input type="text" className={inp}
                  value={form.openingHours}
                  onChange={e => setForm({ ...form, openingHours: e.target.value })}
                  placeholder="Mon–Sat: 9am–8pm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">City</label>
                  <input type="text" className={inp}
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    placeholder="Mumbai" />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">WhatsApp</label>
                  <input type="tel" className={inp}
                    value={form.whatsapp}
                    onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="+91..." />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Address</label>
                <input type="text" className={inp}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Shop / area address" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">Website</label>
                  <input type="text" className={inp}
                    value={form.website}
                    onChange={e => setForm({ ...form, website: e.target.value })}
                    placeholder="example.com" />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">Instagram</label>
                  <input type="text" className={inp}
                    value={form.instagram}
                    onChange={e => setForm({ ...form, instagram: e.target.value })}
                    placeholder="@handle" />
                </div>
              </div>

              <button type="button" onClick={() => { setEditing(false); setLocation("/app/settings"); }}
                className="w-full mt-2 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition">
                Aur options chahiye? Settings mein jao →
              </button>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/50 flex gap-2">
              <button onClick={() => setEditing(false)} disabled={saving}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98] transition disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className={`flex-1 py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50
                  ${saved ? "bg-green-500 text-white" : "bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:shadow-lg hover:shadow-primary/25"}`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" />
                  : saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                  : <><Save className="w-4 h-4" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
