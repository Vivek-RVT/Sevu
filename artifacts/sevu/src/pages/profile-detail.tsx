import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, MapPin, MessageCircle, Briefcase,
  Calendar, Loader2, Clock, BadgeCheck, Wrench,
  ChevronLeft, ChevronRight, X, Phone, User,
  Globe, Instagram, ExternalLink, Sparkles, ArrowRight,
  CheckCircle2, DollarSign, ThumbsUp, ShieldCheck, Send, Users,
  Navigation, Camera, Flame
} from "lucide-react";
import { format } from "date-fns";
import { getWhatsAppLink } from "@/lib/whatsapp";

/* ── Reviewer stored locally ──────────────────────────────── */
interface ReviewerInfo { name: string; phone?: string; age?: number; }
function getReviewer(): ReviewerInfo | null {
  try { return JSON.parse(localStorage.getItem("sevuPublicReviewer") || "null"); }
  catch { return null; }
}
function saveReviewer(u: ReviewerInfo) { localStorage.setItem("sevuPublicReviewer", JSON.stringify(u)); }

/* ── Recent Work gallery ─────────────────────────────────── */
function Gallery({ images }: { images: string[] }) {
  const [lb, setLb] = useState<number | null>(null);
  if (!images?.length) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500 flex-shrink-0">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">Recent Work</h2>
          <p className="text-xs text-gray-400">Tap any photo to see full size</p>
        </div>
      </div>
      {/* Grid layout — 2 cols if 2+, else single */}
      <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {images.map((url, i) => (
          <button key={i} onClick={() => setLb(i)}
            className={`relative rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 active:scale-[0.98] transition-transform
              ${images.length >= 3 && i === 0 ? "col-span-2 h-48" : "h-36"}`}>
            <img src={url} alt={`Work ${i + 1}`} className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Photo"; }} />
            <div className="absolute inset-0 bg-black/0 active:bg-black/10 transition-colors" />
          </button>
        ))}
      </div>
      {/* Lightbox */}
      {lb !== null && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setLb(null)}>
          <div className="flex items-center justify-between p-4 flex-shrink-0">
            <span className="text-white/60 text-sm font-medium">{lb + 1} / {images.length}</span>
            <button className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white" onClick={() => setLb(null)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4 relative" onClick={e => e.stopPropagation()}>
            <img src={images[lb]} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
            {images.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setLb(i => ((i ?? 0) - 1 + images.length) % images.length); }}
                  className="absolute left-2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={e => { e.stopPropagation(); setLb(i => ((i ?? 0) + 1) % images.length); }}
                  className="absolute right-2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 px-4 pb-6 overflow-x-auto flex-shrink-0" onClick={e => e.stopPropagation()}>
              {images.map((url, i) => (
                <button key={i} onClick={() => setLb(i)}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-colors ${i === lb ? "border-white" : "border-white/20"}`}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── PostCard: a carousel post (1 or 2 images + caption) ── */
function PostCard({ post }: { post: { id: number; caption: string | null; images: string[]; createdAt: string } }) {
  const [idx, setIdx] = useState(0);
  const [lb, setLb] = useState(false);
  const total = post.images.length;
  const safeIdx = Math.min(idx, total - 1);
  const next = () => setIdx(i => (i + 1) % total);
  const prev = () => setIdx(i => (i - 1 + total) % total);
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <div className="relative bg-gray-100 aspect-square">
        <img
          src={post.images[safeIdx]}
          alt=""
          onClick={() => setLb(true)}
          className="w-full h-full object-cover cursor-zoom-in active:opacity-95 transition"
          onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Photo"; }}
        />
        {total > 1 && (
          <>
            <button onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-sm text-white flex items-center justify-center active:scale-95 transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-sm text-white flex items-center justify-center active:scale-95 transition">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute top-2 right-2 bg-black/55 text-white text-[11px] font-bold px-2 py-1 rounded-full">
              {safeIdx + 1} / {total}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {post.images.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === safeIdx ? "bg-white w-4" : "bg-white/55"}`} />
              ))}
            </div>
          </>
        )}
      </div>
      {(post.caption || post.createdAt) && (
        <div className="p-4">
          {post.caption && (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line mb-2">{post.caption}</p>
          )}
          <p className="text-[11px] text-gray-400 font-medium">
            {format(new Date(post.createdAt), "d MMM, yyyy")}
          </p>
        </div>
      )}

      {/* Lightbox */}
      {lb && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setLb(false)}>
          <div className="flex items-center justify-between p-4 flex-shrink-0">
            <span className="text-white/60 text-sm font-medium">{safeIdx + 1} / {total}</span>
            <button className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white" onClick={() => setLb(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4 relative" onClick={e => e.stopPropagation()}>
            <img src={post.images[safeIdx]} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
            {total > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); prev(); }}
                  className="absolute left-2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={e => { e.stopPropagation(); next(); }}
                  className="absolute right-2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Star picker ─────────────────────────────────────────── */
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button"
          onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="p-0.5 transition-transform hover:scale-110 active:scale-95">
          <Star className={`w-9 h-9 transition-colors ${(hovered || value) >= s ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

/* ── Reviewer info modal ─────────────────────────────────── */
function ReviewIdentityModal({
  onDone, onClose
}: {
  onDone: (info: ReviewerInfo) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");

  const inp = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium";

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex flex-col items-center justify-end sm:justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Before you review</h3>
            <p className="text-sm text-gray-500 mt-0.5">Just a few details — no account needed</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) return;
          const info: ReviewerInfo = {
            name: name.trim(),
            phone: phone.trim() || undefined,
            age: age ? parseInt(age) : undefined,
          };
          saveReviewer(info);
          onDone(info);
        }} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <User className="w-3 h-3" /> Your Name *
            </label>
            <input type="text" required placeholder="e.g. Priya Sharma"
              className={inp} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Phone className="w-3 h-3" /> Phone <span className="font-normal normal-case">(optional)</span>
            </label>
            <input type="tel" placeholder="9876543210"
              className={inp} value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              Age <span className="font-normal normal-case">(optional)</span>
            </label>
            <input type="number" min={10} max={100} placeholder="e.g. 28"
              className={inp} value={age} onChange={e => setAge(e.target.value)} />
          </div>
          <button type="submit"
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all">
            Continue to Review →
          </button>
        </form>
      </div>
      {/* Spacer: pushes modal above the bottom nav on mobile */}
      <div className="h-16 w-full flex-shrink-0 sm:hidden" style={{ height: "calc(4rem + env(safe-area-inset-bottom, 0px))" }} />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function ProfileDetail() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const [reviewer, setReviewer] = useState<ReviewerInfo | null>(() => getReviewer());
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", slug],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${slug}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    }
  });

  const { data: posts = [] } = useQuery<{ id: number; caption: string | null; images: string[]; createdAt: string }[]>({
    queryKey: ["profile-posts-public", slug],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${slug}/posts`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (profile) {
      document.title = `${profile.name} — ${profile.service} in ${profile.city}`;
    }
    // track view
    if (slug) {
      fetch(`/api/profiles/${slug}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "view" }),
      }).catch(() => {});
    }
  }, [profile, slug]);

  const submitReview = useMutation({
    mutationFn: async (data: object) => {
      const res = await fetch(`/api/profiles/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["profile", slug] });
    }
  });

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewer) { setShowIdentityModal(true); return; }
    if (!comment.trim()) return;
    submitReview.mutate({
      reviewerName: reviewer.name,
      reviewerPhone: reviewer.phone,
      reviewerAge: reviewer.age,
      rating,
      comment: comment.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500/50" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Profile not found</h1>
        <p className="text-gray-500">This page may have been moved or deleted.</p>
      </div>
    );
  }

  const services: string[] = profile.servicesOffered
    ? profile.servicesOffered.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];
  const workImages: string[] = profile.workImages || [];
  const whatsappMessage = `Hi ${profile.name}, I found your profile on Sevu and would like to know more about your ${profile.service} services.`;
  const avgRating = profile.rating || 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Public header with Sevu branding ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Back button */}
          <button onClick={() => window.history.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2 flex-1">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Sevu" className="w-7 h-7 rounded-lg shadow-sm object-contain" />
            <div className="leading-none">
              <p className="font-extrabold text-gray-900 text-base tracking-tight leading-none">Sevu</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest leading-none mt-0.5">Profile</p>
            </div>
          </div>

          {/* CTA */}
          <a href="/onboarding"
            className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors flex-shrink-0">
            Join Free →
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-20 space-y-5 pt-5">

        {/* ── HERO ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 relative">
          {/* Cover — shop photo or gradient fallback */}
          <div className="h-36 rounded-t-3xl overflow-hidden relative">
            {profile.shopImage ? (
              <img src={profile.shopImage} alt="Shop" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              </div>
            )}
            {profile.isAvailable24x7 && (
              <span className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-bold text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Open 24×7
              </span>
            )}
          </div>

          {/* Avatar — sits ON the border between cover and content */}
          <div className="absolute left-5 top-[96px]">
            <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-xl flex items-center justify-center text-4xl font-bold text-blue-600 uppercase overflow-hidden">
              {profile.profileImage
                ? <img src={profile.profileImage} alt={profile.name} className="w-full h-full object-cover" />
                : <span className="leading-none">{profile.name.charAt(0)}</span>
              }
            </div>
          </div>

          <div className="px-5 pb-5 pt-20">
            {/* Name + Verified */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">{profile.name}</h1>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-sm font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                    <Briefcase className="w-3.5 h-3.5" />{profile.service}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="w-3.5 h-3.5" />{profile.city}
                  </span>
                  {profile.yearsExperience && (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />{profile.yearsExperience}+ yrs exp
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 flex-wrap">
              {avgRating > 0 ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                  <span className="font-bold text-gray-900">{avgRating.toFixed(1)}</span>
                  <span className="text-sm text-gray-400">({profile.totalReviews} reviews)</span>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                  <Star className="w-3.5 h-3.5 text-gray-300" />
                  New — be the first to review!
                </span>
              )}
              {profile.totalJobs > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-600 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {profile.totalJobs} jobs done
                </div>
              )}
              {profile.totalReviews > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-600 font-semibold">
                  <Users className="w-4 h-4 text-blue-400" />
                  {profile.totalReviews} happy customers
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="space-y-3">
          {/* PRIMARY: WhatsApp — pulse ring for attention */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-[20px] bg-[#25D366]/30 animate-pulse" />
            <a href={getWhatsAppLink(profile.whatsapp || profile.phone, whatsappMessage)}
              target="_blank" rel="noopener noreferrer"
              onClick={() => fetch(`/api/profiles/${slug}/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "whatsapp" }) }).catch(() => {})}
              className="relative flex items-center justify-center gap-3 bg-[#25D366] text-white py-5 rounded-2xl font-bold shadow-lg shadow-green-500/40 active:scale-[0.98] transition-all text-lg w-full">
              <MessageCircle className="w-6 h-6" />
              <span>WhatsApp Now</span>
              <span className="text-green-100 text-sm font-normal ml-1">— Free & Instant</span>
            </a>
          </div>
          {/* SECONDARY: Send Request + Call side by side */}
          <div className="grid grid-cols-2 gap-3">
            <a href={getWhatsAppLink(profile.whatsapp || profile.phone, `Hi ${profile.name}, I found your profile on Sevu. I'd like to request your ${profile.service} services. Are you available?`)}
              target="_blank" rel="noopener noreferrer"
              onClick={() => fetch(`/api/profiles/${slug}/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "whatsapp" }) }).catch(() => {})}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-2xl font-bold shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all text-sm">
              <Send className="w-4 h-4" /> Send Request
            </a>
            <a href={`tel:${profile.phone}`}
              onClick={() => fetch(`/api/profiles/${slug}/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "call" }) }).catch(() => {})}
              className="flex items-center justify-center gap-2 bg-white text-gray-900 border-2 border-gray-200 py-3.5 rounded-2xl font-bold active:scale-[0.98] transition-all hover:border-gray-300 text-sm">
              <Phone className="w-4 h-4" /> Call Now
            </a>
          </div>
        </div>

        {/* ── POSTS — carousel posts of work ── */}
        {posts.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">Posts</h2>
                <p className="text-xs text-gray-400">Latest work updates</p>
              </div>
            </div>
            <div className="space-y-4">
              {posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        )}

        {/* ── RECENT WORK — moved high for social proof ── */}
        {workImages.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <Gallery images={workImages} />
          </div>
        )}

        {/* ── SERVICES LIST ── */}
        {services.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" /> Services Offered
            </h2>
            <div className="space-y-2">
              {services.map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-800">{s}</span>
                </div>
              ))}
            </div>
            {profile.priceRange && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">Price range:</span>
                <span className="font-semibold text-gray-900">{profile.priceRange}</span>
              </div>
            )}
          </div>
        )}

        {/* ── ABOUT ── */}
        {profile.description && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{profile.description}</p>
          </div>
        )}

        {/* ── INFO: Hours, Website, Instagram ── */}
        {(profile.openingHours || profile.website || profile.instagram) && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Business Info</h2>
            {profile.openingHours && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Hours</p>
                  <p className="font-semibold text-gray-800">{profile.openingHours}</p>
                </div>
              </div>
            )}
            {profile.website && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Globe className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Website</p>
                  <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-semibold text-blue-600 hover:underline flex items-center gap-1 truncate">
                    {profile.website} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              </div>
            )}
            {profile.instagram && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Instagram className="w-4 h-4 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Instagram</p>
                  <a href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-semibold text-pink-600 hover:underline">
                    @{profile.instagram.replace(/^@/, "")}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LOCATION ── */}
        {(profile.address || profile.city) && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" /> Location
            </h2>
            {profile.address && (
              <p className="text-gray-600 text-sm mb-3">{profile.address}</p>
            )}
            {/* Google Maps embed */}
            {profile.lat && profile.lng ? (
              <div className="rounded-2xl overflow-hidden border border-gray-100 mb-3">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${profile.lng - 0.01},${profile.lat - 0.01},${profile.lng + 0.01},${profile.lat + 0.01}&layer=mapnik&marker=${profile.lat},${profile.lng}`}
                  width="100%" height="180" className="block" title="Map" loading="lazy"
                />
              </div>
            ) : null}
            {/* View on Google Maps button */}
            <a
              href={
                profile.lat && profile.lng
                  ? `https://www.google.com/maps?q=${profile.lat},${profile.lng}`
                  : `https://www.google.com/maps/search/${encodeURIComponent((profile.address || profile.name + " " + profile.city))}`
              }
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl border border-blue-100 transition-colors text-sm">
              <Navigation className="w-4 h-4" /> View on Google Maps
            </a>
          </div>
        )}

        {/* ── REVIEWS ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-amber-500" />
              Reviews
              <span className="text-base font-normal text-gray-400">({profile.reviews?.length || 0})</span>
            </h2>
            {avgRating > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-xl">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-bold text-amber-700">{avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Rating breakdown */}
          {profile.reviews && profile.reviews.length >= 2 && (() => {
            const counts = [5, 4, 3, 2, 1].map(star => ({
              star,
              count: profile.reviews.filter((r: any) => Math.round(r.rating) === star).length,
            }));
            const total = profile.reviews.length;
            return (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Rating Breakdown</p>
                {counts.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-4">{star}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Write a review */}
          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <p className="font-bold text-green-800">Review submitted! 🎉</p>
              <p className="text-sm text-green-600">Thank you for your feedback.</p>
              <button onClick={() => { setSubmitted(false); setRating(5); }}
                className="text-sm text-green-700 font-semibold underline">
                Write another
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Write a Review</h3>
                {reviewer ? (
                  <button onClick={() => { localStorage.removeItem("sevuPublicReviewer"); setReviewer(null); }}
                    className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full hover:text-red-500">
                    <User className="w-3 h-3" />{reviewer.name.split(" ")[0]}
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <button onClick={() => setShowIdentityModal(true)}
                    className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    + Add your name
                  </button>
                )}
              </div>

              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Your Rating</p>
                  <StarPicker value={rating} onChange={setRating} />
                </div>
                <div>
                  <textarea
                    rows={3}
                    placeholder="How was your experience? Be honest 😊"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm resize-none"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                </div>
                {!reviewer && (
                  <p className="text-xs text-gray-400 text-center">
                    We'll ask your name before submitting
                  </p>
                )}
                <button type="submit" disabled={submitReview.isPending || !comment.trim()}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-md active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  {submitReview.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                    <Star className="w-4 h-4 fill-current" /> Submit Review
                  </>}
                </button>
              </form>
            </div>
          )}

          {/* Review list */}
          {profile.reviews && profile.reviews.length > 0 ? (
            <div className="space-y-3">
              {profile.reviews.map((review: any) => (
                <div key={review.id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-sm">
                        {review.reviewerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 text-sm">{review.reviewerName}</p>
                          <span className="inline-flex items-center gap-0.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full font-semibold">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(review.createdAt), "d MMM yyyy")}
                          {review.reviewerAge && <span> · {review.reviewerAge} yrs</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 bg-amber-50 px-2.5 py-1 rounded-lg">
                      <span className="font-bold text-amber-600 text-sm">{review.rating}</span>
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-gray-600 text-sm leading-relaxed mt-1">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-t border-gray-100">
              <Star className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="font-semibold text-gray-600">No reviews yet</p>
              <p className="text-sm text-gray-400 mt-0.5">Be the first to review {profile.name}!</p>
            </div>
          )}
        </div>

        {/* ── JOIN SEVU CTA ── */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -right-2 -bottom-8 w-20 h-20 bg-white/5 rounded-full" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-bold text-white/80 uppercase tracking-wide">For Service Providers</span>
            </div>
            <h3 className="text-xl font-bold mb-1">Grow your business with Sevu</h3>
            <p className="text-white/70 text-sm mb-4 font-light">
              Track customers, send reminders, collect reviews — apna khud ka Google My Business
            </p>
            <a href="/onboarding"
              className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-5 py-3 rounded-xl shadow-md active:scale-95 transition-all hover:-translate-y-0.5 text-sm">
              Start Free Today <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

      </main>

      {/* Identity modal */}
      {showIdentityModal && (
        <ReviewIdentityModal
          onDone={info => { setReviewer(info); setShowIdentityModal(false); }}
          onClose={() => setShowIdentityModal(false)}
        />
      )}
    </div>
  );
}
