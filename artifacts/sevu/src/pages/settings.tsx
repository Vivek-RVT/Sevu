import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocation, Redirect } from "wouter";
import { useGetBusiness, useUpdateBusiness } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useBusinessId } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  Loader2, Save, Store, MessageSquare, Star, LogOut,
  Globe, Plus, X, Wrench, BadgeCheck, DollarSign,
  CheckCircle2, ExternalLink, MapPin, AlertCircle, Instagram,
  Link, MessageCircle, Search, Phone, ChevronLeft, ChevronRight, Upload, Camera,
  Pencil, Tag, FileText, Download,
} from "lucide-react";
import { CATEGORY_CONFIG, JOB_TYPE_ICONS } from "@/lib/categoryConfig";

async function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = document.createElement("img") as HTMLImageElement;
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        resolve(compressed.size < file.size ? compressed : file);
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const CATEGORIES = [
  "Salon / Barbershop", "Gym / Fitness", "Spa / Wellness", "Plumber",
  "Electrician", "Doctor / Clinic", "Dentist", "Lab / Diagnostics", "Tailor",
  "AC Repair", "Car Mechanic", "Bike Repair", "Home Cleaning",
  "Painter", "Carpenter", "RO / Water Filter", "Real Estate",
  "Interior Designer", "CCTV Installation", "Solar Panel", "Laptop Repair",
  "Tutor", "Photographer", "Makeup Artist", "Event Planner", "Other",
];

const CATEGORY_FEATURES: Record<string, { label: string; placeholder: string }> = {
  "Salon / Barbershop": { label: "Services Offered", placeholder: "Haircut, Shave, Color, Blowdry, Facial..." },
  "Gym / Fitness": { label: "Facilities / Classes", placeholder: "Weight training, Zumba, Yoga, CrossFit..." },
  "Spa / Wellness": { label: "Treatments Offered", placeholder: "Massage, Facials, Body wraps, Aromatherapy..." },
  "Plumber": { label: "Specializations", placeholder: "Pipe repair, Leak fixing, Bathroom fitting..." },
  "Electrician": { label: "Services Offered", placeholder: "Wiring, Panel upgrades, Lighting, CCTV..." },
  "Doctor / Clinic": { label: "Specialization / OPD", placeholder: "General medicine, Mon-Sat 9am-6pm..." },
  "Dentist": { label: "Dental Services", placeholder: "Cleaning, Root canal, Braces, Implants..." },
  "Lab / Diagnostics": { label: "Tests Available", placeholder: "CBC, Thyroid, Blood sugar, Lipid profile, Vitamin D, Home collection..." },
  "Tailor": { label: "Tailoring Speciality", placeholder: "Wedding wear, Alterations, Suits, Blouses..." },
  "AC Repair": { label: "Services Offered", placeholder: "AC service, Gas refill, Installation, Repair..." },
  "Car Mechanic": { label: "Specializations", placeholder: "Engine repair, Denting, Painting, Service..." },
  "Bike Repair": { label: "Specializations", placeholder: "Engine repair, Tyre change, Chain, Servicing..." },
  "Home Cleaning": { label: "Services Offered", placeholder: "Deep cleaning, Sofa cleaning, Kitchen, Bathroom..." },
  "Painter": { label: "Services Offered", placeholder: "Interior painting, Exterior, Texture, Waterproofing..." },
  "Carpenter": { label: "Specializations", placeholder: "Furniture repair, Modular, Doors, Cabinets..." },
  "RO / Water Filter": { label: "Services Offered", placeholder: "RO installation, Filter change, Repair, AMC..." },
  "Real Estate": { label: "Services Offered", placeholder: "Buy, Sell, Rent, Property management, Valuation..." },
  "Interior Designer": { label: "Services Offered", placeholder: "Home design, Office, Modular kitchen, 3D design..." },
  "CCTV Installation": { label: "Services Offered", placeholder: "CCTV setup, DVR/NVR, Maintenance, Monitoring..." },
  "Solar Panel": { label: "Services Offered", placeholder: "Solar installation, Inverter, Maintenance, AMC..." },
  "Laptop Repair": { label: "Services Offered", placeholder: "Screen repair, Keyboard, Software, Data recovery..." },
  "Tutor": { label: "Subjects / Levels", placeholder: "Maths, Science, English, IIT-JEE, NEET, Board exams..." },
  "Photographer": { label: "Specializations", placeholder: "Wedding, Portrait, Product, Events, Baby shoot..." },
  "Makeup Artist": { label: "Services Offered", placeholder: "Bridal, Party, HD makeup, Hairstyling..." },
  "Event Planner": { label: "Event Types", placeholder: "Wedding, Birthday, Corporate, Decoration, Catering..." },
  "Other": { label: "Services Offered", placeholder: "List your key services here..." },
};

const HOURS_PRESETS = [
  "Mon–Sat: 9am–8pm", "Mon–Sun: 10am–9pm",
  "Mon–Fri: 8am–6pm", "Daily: 24 Hours",
];

type Tab = "business" | "profile" | "messages" | "language";

const inp = "w-full px-4 py-3.5 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm font-medium placeholder:text-muted-foreground/50";

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-base">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function CardHeader({ icon, title, subtitle, onEdit, editing }: {
  icon: React.ReactNode; title: string; subtitle?: string; onEdit?: () => void; editing?: boolean;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} />
      {onEdit && !editing && (
        <button type="button" onClick={onEdit}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-xl transition-colors flex-shrink-0 mt-0.5">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

function ViewRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0 pt-0.5 leading-relaxed">{label}</span>
      <span className="text-sm font-medium flex-1 text-foreground">{String(value)}</span>
    </div>
  );
}

function SaveButton({ loading, saved, label = "Save Changes" }: { loading: boolean; saved: boolean; label?: string }) {
  return (
    <button type="submit" disabled={loading}
      className={`w-full py-4 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50
        ${saved ? "bg-green-500 text-white" : "bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5"}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> {label}</>}
    </button>
  );
}

function Toggle({ checked, onChange, label, subtitle }: { checked: boolean; onChange: () => void; label: string; subtitle?: string }) {
  return (
    <button type="button" onClick={onChange}
      className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/50 hover:bg-muted rounded-2xl border-2 border-border transition-all">
      <div className="text-left">
        <p className="text-sm font-semibold">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-6" : ""}`} />
      </div>
    </button>
  );
}

type AdjustType = "profile" | "shop" | "work";
interface PendingAdjust { file: File; type: AdjustType; }

function ImageAdjustModal({ pending, onConfirm, onCancel }: {
  pending: PendingAdjust;
  onConfirm: (blob: File) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  /* Lock body scroll while modal is open */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const isProfile = pending.type === "profile";
  const OUTPUT_W = isProfile ? 800 : 1200;
  const OUTPUT_H = isProfile ? 800 : pending.type === "shop" ? 675 : 900;
  const DISPLAY = isProfile ? 260 : 280;
  const DISPLAY_H = isProfile ? 260 : Math.round(DISPLAY * OUTPUT_H / OUTPUT_W);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded) return;
    const ctx = canvas.getContext("2d")!;
    // Fill with black so no white ever shows through
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);
    const baseScale = Math.max(OUTPUT_W / img.naturalWidth, OUTPUT_H / img.naturalHeight);
    const s = baseScale * scale;
    const scaledW = img.naturalWidth * s;
    const scaledH = img.naturalHeight * s;
    let cx = OUTPUT_W / 2 + offset.x * (OUTPUT_W / DISPLAY);
    let cy = OUTPUT_H / 2 + offset.y * (OUTPUT_H / DISPLAY_H);
    // Clamp so image always covers the full canvas — no background visible
    cx = Math.min(scaledW / 2, Math.max(OUTPUT_W - scaledW / 2, cx));
    cy = Math.min(scaledH / 2, Math.max(OUTPUT_H - scaledH / 2, cy));
    ctx.drawImage(img, cx - scaledW / 2, cy - scaledH / 2, scaledW, scaledH);
  }, [scale, offset, loaded, OUTPUT_W, OUTPUT_H, DISPLAY, DISPLAY_H]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setLoaded(true); };
    img.src = URL.createObjectURL(pending.file);
    return () => URL.revokeObjectURL(img.src);
  }, [pending.file]);

  useEffect(() => { draw(); }, [draw]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x, dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onPointerUp = () => { dragging.current = false; };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      onConfirm(new File([blob], "adjusted.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.88);
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center backdrop-blur-sm p-4"
      onClick={onCancel}
      /* Prevent any touch from scrolling the page behind the overlay */
      style={{ touchAction: "none" }}
    >
      <div
        className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-5 animate-in zoom-in-95 fade-in duration-200"
        onClick={e => e.stopPropagation()}
        /* Allow the modal content itself to scroll if it's taller than viewport */
        style={{ maxHeight: "calc(100dvh - 2rem)", overflowY: "auto", touchAction: "auto" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Adjust Photo</h3>
            <p className="text-xs text-muted-foreground">Drag to reposition · Slider to zoom</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/80">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas preview */}
        <div className="flex flex-col items-center gap-3 mb-4">
          {/* Main draggable canvas — touch-action:none stops the page from scrolling while dragging */}
          <div
            className={`relative overflow-hidden border-2 border-border shadow cursor-move ${isProfile ? "rounded-full" : "rounded-2xl"}`}
            style={{ width: DISPLAY, height: DISPLAY_H, touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
            <canvas ref={canvasRef} width={OUTPUT_W} height={OUTPUT_H}
              className="absolute inset-0 w-full h-full" style={{ imageRendering: "auto" }} />
            {!loaded && <div className="absolute inset-0 flex items-center justify-center bg-muted"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          </div>
          {isProfile && (
            <p className="text-xs text-muted-foreground text-center">Preview matches how it appears on your profile</p>
          )}
        </div>

        {/* Zoom slider — min=1 ensures image always covers edges */}
        <div className="mb-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Zoom</label>
            <span className="text-xs text-muted-foreground font-mono">{scale.toFixed(2)}×</span>
          </div>
          <input type="range" min={1} max={4} step={0.01} value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className="w-full accent-primary" />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-2xl font-semibold text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={!loaded}
            className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-primary to-secondary text-white shadow-md disabled:opacity-50 transition-all active:scale-[0.98]">
            Use This Photo
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Settings() {
  const { businessId, setBusinessId } = useBusinessId();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("business");
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const queryClient = useQueryClient();

  const TAB_IDS: Tab[] = ["business", "profile", "messages", "language"];
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const goToTab = useCallback((tab: Tab) => {
    const from = TAB_IDS.indexOf(activeTab);
    const to   = TAB_IDS.indexOf(tab);
    if (from === to) return;
    setSlideDir(to > from ? "left" : "right");
    setActiveTab(tab);
  }, [activeTab]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = TAB_IDS.indexOf(activeTab);
    if (dx < 0 && idx < TAB_IDS.length - 1) goToTab(TAB_IDS[idx + 1]);
    if (dx > 0 && idx > 0)                  goToTab(TAB_IDS[idx - 1]);
  }, [activeTab, goToTab]);

  if (!businessId) return <Redirect to="/app/login" />;

  const { data: business, isLoading } = useGetBusiness(businessId);
  const updateBusiness = useUpdateBusiness();

  const [formData, setFormData] = useState({
    name: "", category: "", phone: "", address: "",
    reviewLink: "", defaultReminderMessage: "", defaultReviewMessage: "",
  });

  const [profileData, setProfileData] = useState({
    city: "", description: "", priceRange: "", isAvailable24x7: false,
    yearsExperience: "", servicesOffered: "", certifications: "",
    openingHours: "", website: "", instagram: "", whatsapp: "",
    workImages: [] as string[], address: "",
    lat: undefined as number | undefined, lng: undefined as number | undefined,
    profileImage: "" as string,
    shopImage: "" as string,
    selectedServices: [] as string[], jobType: "",
  });

  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const profileSlugRef = useRef<string | null>(null);
  useEffect(() => { profileSlugRef.current = profileSlug; }, [profileSlug]);

  const patchProfile = async (fields: Record<string, unknown>) => {
    const slug = profileSlugRef.current;
    if (!slug) return;
    await fetch(`/api/profiles/${slug}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    queryClient.invalidateQueries({ queryKey: ["profile", slug] });
  };

  const [editingBusiness, setEditingBusiness] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingMessages, setEditingMessages] = useState(false);

  const [isCompressingPic, setIsCompressingPic] = useState(false);
  const [isCompressingWork, setIsCompressingWork] = useState(false);
  const [isCompressingShop, setIsCompressingShop] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [pendingAdjust, setPendingAdjust] = useState<PendingAdjust | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{ images: string[]; index: number } | null>(null);

  const profilePicInput = useRef<HTMLInputElement>(null);
  const workPhotoInput = useRef<HTMLInputElement>(null);
  const shopPhotoInput = useRef<HTMLInputElement>(null);

  const saveImageRecord = async (objectPath: string, type: string) => {
    try {
      await fetch("/api/storage/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath, type, isPublic: true }),
      });
    } catch {
      /* non-fatal — image still works via private endpoint */
    }
  };

  const toPublicUrl = (objectPath: string) =>
    `/api/storage/profile-objects${objectPath.replace(/^\/objects/, "")}`;

  const profilePicUpload = useUpload({
    onSuccess: (res) => {
      const url = toPublicUrl(res.objectPath);
      saveImageRecord(res.objectPath, "profile");
      setProfileData(p => ({ ...p, profileImage: url }));
      patchProfile({ profileImage: url });
      setUploadError(null);
    },
    onError: (err) => setUploadError(`Profile photo: ${err.message}`),
  });

  const shopPhotoUpload = useUpload({
    onSuccess: (res) => {
      const url = toPublicUrl(res.objectPath);
      saveImageRecord(res.objectPath, "shop");
      setProfileData(p => ({ ...p, shopImage: url }));
      patchProfile({ shopImage: url });
      setUploadError(null);
    },
    onError: (err) => setUploadError(`Shop photo: ${err.message}`),
  });

  const workPhotoUpload = useUpload({
    onSuccess: (res) => {
      const url = toPublicUrl(res.objectPath);
      saveImageRecord(res.objectPath, "work");
      setProfileData(p => {
        const updated = [...p.workImages, url];
        patchProfile({ workImages: updated });
        return { ...p, workImages: updated };
      });
      setUploadError(null);
    },
    onError: (err) => setUploadError(`Work photo: ${err.message}`),
  });

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportPDF = async () => {
    if (exportingPdf) return;
    setExportError(null);
    setExportingPdf(true);
    try {
      const [customersRes, logsRes] = await Promise.all([
        fetch(`/api/customers?businessId=${businessId}`).then(r => r.json()),
        fetch(`/api/service-logs?businessId=${businessId}`).then(r => r.json()),
      ]);
      const customers: any[] = Array.isArray(customersRes) ? customersRes : [];
      const logs: any[] = Array.isArray(logsRes) ? logsRes : [];

      const logsByCustomer = new Map<number, any[]>();
      for (const l of logs) {
        const arr = logsByCustomer.get(l.customerId) || [];
        arr.push(l);
        logsByCustomer.set(l.customerId, arr);
      }
      for (const arr of logsByCustomer.values()) {
        arr.sort((a, b) =>
          new Date(b.serviceDate || 0).getTime() - new Date(a.serviceDate || 0).getTime()
        );
      }

      const totalEarned = logs
        .filter(l => l.paymentStatus === "paid")
        .reduce((s, l) => s + (l.amount || 0), 0)
        + logs
          .filter(l => l.paymentStatus === "partial")
          .reduce((s, l) => s + (l.paidAmount || 0), 0);
      const totalDue = logs
        .filter(l => l.paymentStatus === "pending")
        .reduce((s, l) => s + (l.amount || 0), 0)
        + logs
          .filter(l => l.paymentStatus === "partial")
          .reduce((s, l) => s + ((l.amount || 0) - (l.paidAmount || 0)), 0);

      const esc = (s: any) =>
        String(s ?? "").replace(/[&<>"']/g, c =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
        );
      const fmtDate = (d: any) => {
        if (!d) return "—";
        try {
          return new Date(d).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
          });
        } catch { return String(d); }
      };
      const inr = (n: any) =>
        n == null || n === 0 ? "—" : "₹" + Number(n).toLocaleString("en-IN");

      const today = new Date().toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      });

      const bizName = esc(business?.name || "Service Business");
      const bizCategory = esc(business?.category || "");
      const bizPhone = esc(business?.phone || "");
      const bizAddress = esc(business?.address || "");

      const customerSections = customers.map(c => {
        const cLogs = logsByCustomer.get(c.id) || [];
        const rows = cLogs.length === 0
          ? `<tr><td colspan="5" class="empty">No services recorded</td></tr>`
          : cLogs.map(l => {
              const status = l.paymentStatus === "paid"
                ? '<span class="badge paid">Paid</span>'
                : l.paymentStatus === "partial"
                  ? '<span class="badge partial">Partial</span>'
                  : '<span class="badge pending">Pending</span>';
              const amt = l.paymentStatus === "partial" && l.paidAmount != null
                ? `${inr(l.paidAmount)} / ${inr(l.amount)}`
                : inr(l.amount);
              return `<tr>
                <td>${fmtDate(l.serviceDate)}</td>
                <td>${esc(l.service || "—")}</td>
                <td class="num">${amt}</td>
                <td>${status}</td>
                <td>${esc(l.note || "")}</td>
              </tr>`;
            }).join("");

        const earned = (c.totalSpent ?? 0);
        const due = (c.outstandingBalance ?? 0);

        return `
          <section class="customer">
            <header class="c-head">
              <div>
                <h2>${esc(c.name)}</h2>
                <p class="c-meta">
                  ${c.phone ? esc(c.phone) : '<span class="muted">No phone</span>'}
                  ${c.address ? ` · ${esc(c.address)}` : ""}
                </p>
              </div>
              <div class="c-totals">
                <div><span class="lbl">Earned</span><span class="val green">${inr(earned)}</span></div>
                ${due > 0 ? `<div><span class="lbl">Due</span><span class="val orange">${inr(due)}</span></div>` : ""}
              </div>
            </header>
            <table>
              <thead>
                <tr>
                  <th style="width:90px">Date</th>
                  <th>Service</th>
                  <th class="num" style="width:120px">Amount</th>
                  <th style="width:80px">Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>
        `;
      }).join("");

      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Service History — ${bizName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         color: #1f2937; margin: 0; padding: 32px 36px; background: #fff; font-size: 12px; }
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 3px solid #6366f1; padding-bottom: 18px; margin-bottom: 24px; }
  .doc-head h1 { margin: 0 0 4px 0; font-size: 24px; color: #111827; }
  .doc-head .sub { color: #6b7280; font-size: 12px; line-height: 1.6; }
  .doc-head .right { text-align: right; color: #6b7280; font-size: 11px; line-height: 1.6; }
  .doc-head .right strong { color: #111827; font-size: 13px; display: block; margin-bottom: 2px; }

  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; }
  .stat .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700; }
  .stat .val { display: block; font-size: 18px; font-weight: 700; color: #111827; margin-top: 4px; }
  .stat .val.green { color: #059669; }
  .stat .val.orange { color: #ea580c; }

  .customer { margin-bottom: 22px; page-break-inside: avoid; }
  .c-head { display: flex; justify-content: space-between; align-items: flex-end;
            border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px; }
  .c-head h2 { margin: 0; font-size: 15px; color: #111827; }
  .c-meta { margin: 2px 0 0; color: #6b7280; font-size: 11px; }
  .c-meta .muted { color: #9ca3af; font-style: italic; }
  .c-totals { display: flex; gap: 18px; }
  .c-totals > div { text-align: right; }
  .c-totals .lbl { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700; }
  .c-totals .val { font-size: 13px; font-weight: 700; color: #111827; }
  .c-totals .val.green { color: #059669; }
  .c-totals .val.orange { color: #ea580c; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f3f4f6; color: #374151; font-weight: 700;
       padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; color: #1f2937; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.empty { text-align: center; color: #9ca3af; font-style: italic; padding: 12px; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge.paid { background: #d1fae5; color: #065f46; }
  .badge.partial { background: #ede9fe; color: #5b21b6; }
  .badge.pending { background: #ffedd5; color: #9a3412; }

  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb;
            text-align: center; color: #9ca3af; font-size: 10px; }

  .empty-state { text-align: center; padding: 40px; color: #9ca3af; font-size: 13px; }

  @media print {
    body { padding: 18mm 14mm; }
    .no-print { display: none; }
    .summary { page-break-after: avoid; }
    .customer { break-inside: avoid; }
  }
  .print-bar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10; }
  .print-bar button { background: #6366f1; color: #fff; border: 0; padding: 10px 16px;
                       border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer;
                       box-shadow: 0 4px 14px rgba(99,102,241,0.4); }
  .print-bar button.secondary { background: #fff; color: #374151; border: 1px solid #d1d5db; box-shadow: none; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="secondary" onclick="window.close()">Close</button>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <header class="doc-head">
    <div>
      <h1>${bizName}</h1>
      <div class="sub">
        ${bizCategory ? esc(bizCategory) + "<br/>" : ""}
        ${bizPhone ? esc(bizPhone) : ""}${bizPhone && bizAddress ? " · " : ""}${bizAddress ? esc(bizAddress) : ""}
      </div>
    </div>
    <div class="right">
      <strong>Service History Report</strong>
      Generated: ${esc(today)}<br/>
      Customers: ${customers.length} · Services: ${logs.length}
    </div>
  </header>

  <div class="summary">
    <div class="stat"><span class="lbl">Customers</span><span class="val">${customers.length}</span></div>
    <div class="stat"><span class="lbl">Services Done</span><span class="val">${logs.length}</span></div>
    <div class="stat"><span class="lbl">Total Earned</span><span class="val green">${inr(totalEarned)}</span></div>
    <div class="stat"><span class="lbl">Outstanding</span><span class="val orange">${inr(totalDue)}</span></div>
  </div>

  ${customers.length === 0
    ? `<div class="empty-state">No customers yet. Add customers and services to see your history.</div>`
    : customerSections}

  <div class="footer">
    Generated by Sevu · ${esc(today)}
  </div>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) {
        setExportError("Please allow popups to export the PDF.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err: any) {
      setExportError(err?.message || "Failed to export. Try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [directoryEnabled, setDirectoryEnabled] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);
  const [msgSaved, setMsgSaved] = useState(false);

  useEffect(() => {
    if (!business) return;
    setFormData({
      name: business.name, category: business.category,
      phone: business.phone || "", address: business.address || "",
      reviewLink: business.reviewLink || "",
      defaultReminderMessage: business.defaultReminderMessage || "Hi [Name], your [ServiceType] service is due. Visit again 😊",
      defaultReviewMessage: business.defaultReviewMessage || "Thank you for your visit 🙏 Please rate our service ⭐ [Review Link]",
    });
    fetch(`/api/profiles?limit=100`).then(r => r.json()).then((profiles: any[]) => {
      const mine = profiles.find((p: any) => p.businessId === businessId);
      if (mine) {
        setProfileSlug(mine.slug);
        setDirectoryEnabled(true);
        setProfileData({
          city: mine.city || "", description: mine.description || "",
          priceRange: mine.priceRange || "", isAvailable24x7: mine.isAvailable24x7 || false,
          yearsExperience: mine.yearsExperience?.toString() || "",
          servicesOffered: mine.servicesOffered || "", certifications: mine.certifications || "",
          openingHours: mine.openingHours || "", website: mine.website || "",
          instagram: mine.instagram || "", whatsapp: mine.whatsapp || "",
          workImages: mine.workImages || [], address: mine.address || "",
          lat: mine.lat, lng: mine.lng,
          profileImage: mine.profileImage || "",
          shopImage: mine.shopImage || "",
        });
      }
    }).catch(() => {});
  }, [business, businessId]);

  const handleBizSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBusiness.mutateAsync({ id: businessId, data: formData });
    setBizSaved(true);
    setEditingBusiness(false);
    setTimeout(() => setBizSaved(false), 3000);
  };

  const handleMsgSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBusiness.mutateAsync({ id: businessId, data: formData });
    setMsgSaved(true);
    setEditingMessages(false);
    setTimeout(() => setMsgSaved(false), 3000);
  };

  const handleSaveProfile = async () => {
    if (!profileSlug) return;
    setProfileSaving(true);
    try {
      await fetch(`/api/profiles/${profileSlug}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileData,
          yearsExperience: profileData.yearsExperience ? parseInt(profileData.yearsExperience) : undefined,
          profileImage: profileData.profileImage || undefined,
          shopImage: profileData.shopImage || undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profile", profileSlug] });
      setProfileSaved(true);
      setEditingProfile(false);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally { setProfileSaving(false); }
  };

  const handleCreateProfile = async () => {
    if (!profileData.city.trim()) return;
    setCreatingProfile(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId, name: formData.name, service: formData.category,
          city: profileData.city, phone: formData.phone || "N/A",
          address: profileData.address || formData.address || undefined,
          lat: profileData.lat, lng: profileData.lng,
          description: profileData.description || undefined, priceRange: profileData.priceRange || undefined,
          servicesOffered: profileData.servicesOffered || undefined, certifications: profileData.certifications || undefined,
          yearsExperience: profileData.yearsExperience ? parseInt(profileData.yearsExperience) : undefined,
          isAvailable24x7: profileData.isAvailable24x7, openingHours: profileData.openingHours || undefined,
          website: profileData.website || undefined, instagram: profileData.instagram || undefined,
          whatsapp: profileData.whatsapp || formData.phone || undefined,
          workImages: profileData.workImages.length > 0 ? profileData.workImages : undefined,
          profileImage: profileData.profileImage || undefined,
          shopImage: profileData.shopImage || undefined,
        }),
      });
      if (res.ok) {
        const p = await res.json();
        setProfileSlug(p.slug); setDirectoryEnabled(true);
        setEditingProfile(false);
        queryClient.invalidateQueries({ queryKey: ["profiles"] });
        setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000);
      }
    } finally { setCreatingProfile(false); }
  };

  const upd = (f: keyof typeof profileData, v: any) => setProfileData(p => ({ ...p, [f]: v }));
  const categoryFeature = CATEGORY_FEATURES[formData.category] || CATEGORY_FEATURES["Other"];

  const { t } = useTranslation();

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "business", label: t("settings.business_tab"), icon: <Store className="w-4 h-4" /> },
    { id: "profile",  label: t("settings.profile_tab"),  icon: <Search className="w-4 h-4" /> },
    { id: "messages", label: t("settings.messages_tab"), icon: <MessageSquare className="w-4 h-4" /> },
    { id: "language", label: t("settings.language_tab"), icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <MobileLayout>
      <div className="max-w-lg mx-auto w-full">

        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-display font-extrabold">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your business account</p>
        </div>

        <div className="px-4 mb-4">
          <div className="flex bg-muted rounded-2xl p-1 gap-1">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => goToTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${activeTab === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div
            key={activeTab}
            className={`px-4 pb-24 space-y-4 ${slideDir === "left" ? "animate-slide-in-left" : slideDir === "right" ? "animate-slide-in-right" : ""}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >

            {/* ── TAB: BUSINESS ── */}
            {activeTab === "business" && (
              <>
                <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                  <CardHeader
                    icon={<Store className="w-5 h-5" />}
                    title="Business Details"
                    subtitle="How you appear to customers"
                    onEdit={() => setEditingBusiness(true)}
                    editing={editingBusiness}
                  />

                  {editingBusiness ? (
                    <form onSubmit={handleBizSave} className="space-y-4">
                      <Field label="Business Name">
                        <input type="text" required className={inp}
                          value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                      </Field>
                      <Field label="Category">
                        <div className="relative">
                          <select className={`${inp} appearance-none`}
                            value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                            <option value="" disabled>Select...</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rotate-90 pointer-events-none" />
                        </div>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Phone">
                          <input type="tel" className={inp} placeholder="+91..."
                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        </Field>
                        <Field label="WhatsApp">
                          <input type="tel" className={inp} placeholder="Same as phone?"
                            value={profileData.whatsapp} onChange={e => upd("whatsapp", e.target.value)} />
                        </Field>
                      </div>
                      <Field label="Address">
                        <AddressAutocomplete value={formData.address}
                          onChange={address => setFormData({ ...formData, address })}
                          placeholder="Search your address..." />
                      </Field>
                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={() => setEditingBusiness(false)}
                          className="flex-1 py-3.5 rounded-2xl font-semibold text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                          Cancel
                        </button>
                        <button type="submit" disabled={updateBusiness.isPending}
                          className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-primary to-secondary text-white shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                          {updateBusiness.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-0.5">
                      <ViewRow label="Business Name" value={formData.name} />
                      <ViewRow label="Category" value={formData.category} />
                      <ViewRow label="Phone" value={formData.phone} />
                      <ViewRow label="WhatsApp" value={profileData.whatsapp} />
                      <ViewRow label="Address" value={formData.address} />
                      {!formData.name && (
                        <p className="text-sm text-muted-foreground py-2">Tap Edit to fill in your business details.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Service History PDF Export ── */}
                <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                  <SectionHeader
                    icon={<FileText className="w-5 h-5" />}
                    title="Service History PDF"
                    subtitle="Apne saare kaam ka record PDF mein nikaale"
                  />
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    Professional report jo har customer, service aur payment ka pura record
                    dikhata hai. Apne records ke liye save karein ya client ko share karein.
                  </p>

                  <button
                    type="button"
                    onClick={handleExportPDF}
                    disabled={exportingPdf}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {exportingPdf ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Preparing report...</>
                    ) : (
                      <><Download className="w-4 h-4" /> Export PDF</>
                    )}
                  </button>

                  {exportError && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{exportError}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
                    Tip: Print dialog mein "Save as PDF" choose karein.
                  </p>
                </div>

                <button type="button" onClick={() => logout().then(() => setLocation("/app/login"))} 
                  className="w-full py-4 text-muted-foreground hover:text-red-500 bg-muted hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border-2 border-transparent hover:border-red-200 dark:hover:border-red-900/30">
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              </>
            )}

            {/* ── TAB: PROFILE ── */}
            {activeTab === "profile" && (
              <>
                {/* Directory toggle */}
                <div className={`rounded-3xl p-5 border-2 transition-all ${directoryEnabled ? "border-secondary/50 bg-secondary/5 dark:bg-secondary/10" : "border-border bg-card"} shadow-sm`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${directoryEnabled ? "bg-secondary text-white" : "bg-muted text-muted-foreground"}`}>
                        <Search className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Get on Google</p>
                        <p className="text-xs text-muted-foreground">
                          {directoryEnabled && profileSlug ? "Live — customers can find you" : "Appear in Google & Sevu search"}
                        </p>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => { if (!profileSlug) setDirectoryEnabled(v => !v); }}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${directoryEnabled ? "bg-secondary" : "bg-muted"} ${profileSlug ? "cursor-default" : ""}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${directoryEnabled ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                  {directoryEnabled && profileSlug && (
                    <a href={`/profile/${profileSlug}`} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm text-secondary font-semibold hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> View your public profile
                    </a>
                  )}
                </div>

                {!directoryEnabled && (
                  <div className="flex items-start gap-3 bg-muted/60 rounded-2xl px-4 py-3.5 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                    <p>Turn on "Get on Google" above to fill in your public profile details.</p>
                  </div>
                )}

                {directoryEnabled && !editingProfile && profileSlug && (
                  <>
                    {/* Location & Hours — view */}
                    <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                      <CardHeader icon={<MapPin className="w-5 h-5" />} title="Location & Hours"
                        onEdit={() => setEditingProfile(true)} editing={false} />
                      <div className="space-y-0.5">
                        <ViewRow label="City" value={profileData.city} />
                        <ViewRow label="Address" value={profileData.address} />
                        <ViewRow label="Opening Hours" value={profileData.openingHours} />
                        <ViewRow label="Available 24×7" value={profileData.isAvailable24x7 ? "Yes" : null} />
                        {!profileData.city && <p className="text-sm text-muted-foreground py-2">Tap Edit to add location details.</p>}
                      </div>
                    </div>

                    {/* About & Services — view */}
                    <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                      <CardHeader icon={<Wrench className="w-5 h-5" />} title="About & Services"
                        onEdit={() => setEditingProfile(true)} editing={false} />
                      <div className="space-y-0.5">
                        <ViewRow label="About" value={profileData.description} />
                        <ViewRow label={categoryFeature.label} value={profileData.servicesOffered} />
                        <ViewRow label="Price Range" value={profileData.priceRange} />
                        <ViewRow label="Years Exp." value={profileData.yearsExperience} />
                        <ViewRow label="Certifications" value={profileData.certifications} />
                        {!profileData.description && !profileData.servicesOffered && (
                          <p className="text-sm text-muted-foreground py-2">Tap Edit to describe your business.</p>
                        )}
                      </div>
                    </div>

                    {/* Online Presence — view */}
                    <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                      <CardHeader icon={<Globe className="w-5 h-5" />} title="Online Presence"
                        onEdit={() => setEditingProfile(true)} editing={false} />
                      <div className="space-y-0.5">
                        <ViewRow label="Website" value={profileData.website} />
                        <ViewRow label="Instagram" value={profileData.instagram ? `@${profileData.instagram}` : null} />
                        {!profileData.website && !profileData.instagram && (
                          <p className="text-sm text-muted-foreground py-2">Tap Edit to add your links.</p>
                        )}
                      </div>
                    </div>

                    {/* Photos — always shown */}
                    {uploadError && (
                      <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl px-4 py-3 text-sm border border-red-200 dark:border-red-800">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold">Upload failed</p>
                          <p className="text-xs mt-0.5 opacity-80">{uploadError}</p>
                        </div>
                        <button type="button" onClick={() => setUploadError(null)} className="flex-shrink-0"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                    <div className="bg-card rounded-3xl border border-border/50 shadow-sm overflow-hidden">
                      <div className="px-5 pt-5 pb-3">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base">Photos</h3>
                            <p className="text-xs text-muted-foreground">Tap any button to upload or change a photo</p>
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-border/60">
                        {/* 1 — Profile Photo */}
                        <div className="px-5 py-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
                              <span className="text-base font-black">1</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-blue-700 dark:text-blue-400">Your Photo (Face / Logo)</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Your face or logo — shows as a round photo on your profile card.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <button type="button"
                                onClick={() => profileData.profileImage && setPreviewGallery({ images: [profileData.profileImage], index: 0 })}
                                className={`w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 overflow-hidden flex items-center justify-center ${profileData.profileImage ? "cursor-pointer active:scale-95 transition-transform" : ""}`}>
                                {profileData.profileImage ? (
                                  <img src={profileData.profileImage} alt="Profile" className="w-full h-full object-cover"
                                    onError={e => { (e.target as HTMLImageElement).src = ""; }} />
                                ) : (
                                  <span className="text-3xl font-bold text-blue-500 uppercase">{formData.name.charAt(0) || "?"}</span>
                                )}
                              </button>
                              {profileData.profileImage && (
                                <button type="button" onClick={() => { upd("profileImage", ""); patchProfile({ profileImage: null }); }}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="flex-1">
                              <input ref={profilePicInput} type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setPendingAdjust({ file, type: "profile" });
                                  e.target.value = "";
                                }} />
                              <button type="button" onClick={() => profilePicInput.current?.click()}
                                disabled={isCompressingPic || profilePicUpload.isUploading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 active:scale-[0.98]">
                                {isCompressingPic ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                  : profilePicUpload.isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {profilePicUpload.progress}%</>
                                  : profileData.profileImage ? <><Camera className="w-4 h-4" /> Change Photo</> : <><Upload className="w-4 h-4" /> Upload Your Photo</>}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 2 — Shop Photo */}
                        <div className="px-5 py-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5">
                              <span className="text-base font-black">2</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-orange-700 dark:text-orange-400">Shop / Office Photo</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Photo of your shop, salon, clinic, or workspace. Shows as the big banner at top of your profile.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="w-16 h-16 rounded-xl bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-200 dark:border-orange-800 overflow-hidden flex items-center justify-center">
                                {profileData.shopImage ? (
                                  <img src={profileData.shopImage} alt="Shop" className="w-full h-full object-cover"
                                    onError={e => { (e.target as HTMLImageElement).src = ""; }} />
                                ) : (
                                  <Store className="w-7 h-7 text-orange-400" />
                                )}
                              </div>
                              {profileData.shopImage && (
                                <button type="button" onClick={() => { upd("shopImage", ""); patchProfile({ shopImage: null }); }}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="flex-1">
                              <input ref={shopPhotoInput} type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setPendingAdjust({ file, type: "shop" });
                                  e.target.value = "";
                                }} />
                              <button type="button" onClick={() => shopPhotoInput.current?.click()}
                                disabled={isCompressingShop || shopPhotoUpload.isUploading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors disabled:opacity-60 active:scale-[0.98]">
                                {isCompressingShop ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                  : shopPhotoUpload.isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {shopPhotoUpload.progress}%</>
                                  : profileData.shopImage ? <><Store className="w-4 h-4" /> Change Shop Photo</> : <><Upload className="w-4 h-4" /> Upload Shop Photo</>}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 3 — Work Photos */}
                        <div className="px-5 py-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">
                              <span className="text-base font-black">3</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-green-700 dark:text-green-400">Work Photos (Before/After)</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Photos of your actual work. Customers see these as a gallery.</p>
                            </div>
                          </div>
                          <input ref={workPhotoInput} type="file" accept="image/*" className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setPendingAdjust({ file, type: "work" });
                              e.target.value = "";
                            }} />
                          <button type="button" onClick={() => workPhotoInput.current?.click()}
                            disabled={isCompressingWork || workPhotoUpload.isUploading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60 active:scale-[0.98]">
                            {isCompressingWork ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                              : workPhotoUpload.isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {workPhotoUpload.progress}%</>
                              : <><Plus className="w-4 h-4" /> Add Work Photo</>}
                          </button>
                          {profileData.workImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              {profileData.workImages.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded-xl overflow-hidden group border-2 border-green-200 dark:border-green-800">
                                  <button type="button" onClick={() => setPreviewGallery({ images: profileData.workImages, index: i })} className="w-full h-full">
                                    <img src={url} alt={`Work ${i + 1}`} className="w-full h-full object-cover"
                                      onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/200x200?text=img"; }} />
                                  </button>
                                  <button type="button" onClick={() => {
                                    const updated = profileData.workImages.filter((_, j) => j !== i);
                                    setProfileData(p => ({ ...p, workImages: updated }));
                                    patchProfile({ workImages: updated });
                                  }}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {profileData.workImages.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-2 text-center">No work photos yet — add some to attract more customers!</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {directoryEnabled && editingProfile && (
                  <div className="space-y-4">
                    {/* Location */}
                    <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm space-y-4">
                      <CardHeader icon={<MapPin className="w-5 h-5" />} title="Location & Hours"
                        subtitle="Help customers find and visit you" editing={true} />
                      <Field label="City *">
                        <input type="text" placeholder="e.g. Mumbai" className={inp}
                          value={profileData.city} onChange={e => upd("city", e.target.value)} />
                      </Field>
                      <Field label="Exact Address">
                        <AddressAutocomplete value={profileData.address}
                          onChange={(address, lat, lng) => setProfileData(p => ({ ...p, address, lat, lng }))}
                          placeholder="Search your shop / clinic address..." />
                      </Field>
                      <Field label="Opening Hours">
                        <input type="text" placeholder="e.g. Mon–Sat: 9am–8pm" className={inp}
                          value={profileData.openingHours} onChange={e => upd("openingHours", e.target.value)} />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {HOURS_PRESETS.map(p => (
                            <button key={p} type="button" onClick={() => upd("openingHours", p)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors
                                ${profileData.openingHours === p ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted border-border hover:bg-primary/5"}`}>
                              {p}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Toggle checked={profileData.isAvailable24x7} onChange={() => upd("isAvailable24x7", !profileData.isAvailable24x7)}
                        label="Available 24×7" subtitle="Emergency / round-the-clock service" />
                    </div>

                    {/* About & Services — Smart / Category-aware */}
                    {(() => {
                      const cfg = CATEGORY_CONFIG[formData.category];
                      const toggleSvc = (svc: string) => {
                        const current = profileData.selectedServices;
                        const next = current.includes(svc) ? current.filter(s => s !== svc) : [...current, svc];
                        setProfileData(d => ({ ...d, selectedServices: next, servicesOffered: next.join(", ") }));
                      };
                      return (
                        <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm space-y-4">
                          <CardHeader icon={<Wrench className="w-5 h-5" />} title="About & Services"
                            subtitle="Tell customers what you offer" editing={true} />
                          <Field label="About Your Business">
                            <textarea rows={2} placeholder="What makes you the best choice?" className={`${inp} resize-none`}
                              value={profileData.description} onChange={e => upd("description", e.target.value)} />
                          </Field>

                          {/* Service chips */}
                          {cfg ? (
                            <div className="space-y-2">
                              <label className="text-sm font-semibold flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                                {cfg.serviceLabelPlural}
                                <span className="text-xs font-normal text-muted-foreground">(tap to select)</span>
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {cfg.services.map(svc => {
                                  const selectedList = profileData.selectedServices ?? [];
                                  const offeredText = profileData.servicesOffered ?? "";
                                  const selected = selectedList.includes(svc) ||
                                    (!selectedList.length && offeredText.includes(svc));
                                  return (
                                    <button key={svc} type="button" onClick={() => toggleSvc(svc)}
                                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95
                                        ${selected ? "bg-primary text-white border-primary shadow-sm" : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>
                                      {selected ? "✓ " : ""}{svc}
                                    </button>
                                  );
                                })}
                              </div>
                              <textarea rows={1} placeholder="Or type additional services..."
                                className={`${inp} resize-none text-xs`}
                                value={profileData.selectedServices.length === 0 ? profileData.servicesOffered : ""}
                                onChange={e => { if (profileData.selectedServices.length === 0) upd("servicesOffered", e.target.value); }} />
                            </div>
                          ) : (
                            <Field label={CATEGORY_FEATURES[formData.category]?.label || "Services Offered"}>
                              <textarea rows={2} placeholder={CATEGORY_FEATURES[formData.category]?.placeholder || "List your services..."}
                                className={`${inp} resize-none`}
                                value={profileData.servicesOffered} onChange={e => upd("servicesOffered", e.target.value)} />
                            </Field>
                          )}

                          {/* Job Type */}
                          {cfg && cfg.jobTypes.length > 1 && (
                            <div className="space-y-2">
                              <label className="text-sm font-semibold">How do you serve customers?</label>
                              <div className="flex flex-wrap gap-2">
                                {cfg.jobTypes.map(jt => (
                                  <button key={jt} type="button" onClick={() => upd("jobType", jt)}
                                    className={`flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border font-semibold transition-all active:scale-95
                                      ${profileData.jobType === jt ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}>
                                    {JOB_TYPE_ICONS[jt]} {jt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Price */}
                          <div className="space-y-2">
                            <label className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> Price Range</label>
                            {cfg && (
                              <div className="flex flex-wrap gap-2">
                                {cfg.priceSuggestions.map(p => (
                                  <button key={p} type="button" onClick={() => upd("priceRange", p)}
                                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95
                                      ${profileData.priceRange === p ? "bg-green-500/10 border-green-500 text-green-700" : "bg-background border-border text-muted-foreground hover:border-green-400 hover:text-green-700"}`}>
                                    {p}
                                  </button>
                                ))}
                              </div>
                            )}
                            <input type="text" placeholder={cfg ? `e.g. ${cfg.priceHint}` : "₹200–₹800"} className={inp}
                              value={profileData.priceRange} onChange={e => upd("priceRange", e.target.value)} />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Years Exp.">
                              <input type="number" min={0} max={99} placeholder="e.g. 5" className={inp}
                                value={profileData.yearsExperience} onChange={e => upd("yearsExperience", e.target.value)} />
                            </Field>
                            <Field label="Certifications">
                              <input type="text" placeholder="ISO, Licensed..." className={inp}
                                value={profileData.certifications} onChange={e => upd("certifications", e.target.value)} />
                            </Field>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Online Presence */}
                    <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm space-y-4">
                      <CardHeader icon={<Globe className="w-5 h-5" />} title="Online Presence"
                        subtitle="Links shown on your public profile" editing={true} />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Website">
                          <input type="url" placeholder="https://..." className={inp}
                            value={profileData.website} onChange={e => upd("website", e.target.value)} />
                        </Field>
                        <Field label="Instagram">
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">@</span>
                            <input type="text" placeholder="handle" className={`${inp} pl-8`}
                              value={profileData.instagram} onChange={e => upd("instagram", e.target.value)} />
                          </div>
                        </Field>
                      </div>
                    </div>

                    {/* Upload error */}
                    {uploadError && (
                      <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl px-4 py-3 text-sm border border-red-200 dark:border-red-800">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold">Upload failed</p>
                          <p className="text-xs mt-0.5 opacity-80">{uploadError}</p>
                        </div>
                        <button type="button" onClick={() => setUploadError(null)} className="flex-shrink-0"><X className="w-4 h-4" /></button>
                      </div>
                    )}

                    {/* Photos */}
                    <div className="bg-card rounded-3xl border border-border/50 shadow-sm overflow-hidden">
                      <div className="px-5 pt-5 pb-3">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base">Photos</h3>
                            <p className="text-xs text-muted-foreground">3 types of photos — each shown differently on your profile</p>
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-border/60">
                        <div className="px-5 py-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
                              <span className="text-base font-black">1</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-blue-700 dark:text-blue-400">Your Photo (Face / Logo)</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Your face or your business logo.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <button type="button"
                                onClick={() => profileData.profileImage && setPreviewGallery({ images: [profileData.profileImage], index: 0 })}
                                className={`w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 overflow-hidden flex items-center justify-center ${profileData.profileImage ? "cursor-pointer" : ""}`}>
                                {profileData.profileImage ? (
                                  <img src={profileData.profileImage} alt="Profile" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = ""; }} />
                                ) : (
                                  <span className="text-2xl font-bold text-blue-500 uppercase">{formData.name.charAt(0) || "?"}</span>
                                )}
                              </button>
                              {profileData.profileImage && (
                                <button type="button" onClick={() => { upd("profileImage", ""); patchProfile({ profileImage: null }); }}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow"><X className="w-3 h-3" /></button>
                              )}
                            </div>
                            <div className="flex-1">
                              <input ref={profilePicInput} type="file" accept="image/*" className="hidden"
                                onChange={(e) => { const file = e.target.files?.[0]; if (file) setPendingAdjust({ file, type: "profile" }); e.target.value = ""; }} />
                              <button type="button" onClick={() => profilePicInput.current?.click()} disabled={isCompressingPic || profilePicUpload.isUploading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60">
                                {isCompressingPic ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : profilePicUpload.isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> {profilePicUpload.progress}%</> : profileData.profileImage ? <><Camera className="w-4 h-4" /> Change</> : <><Upload className="w-4 h-4" /> Upload Photo</>}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="px-5 py-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5">
                              <span className="text-base font-black">2</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-orange-700 dark:text-orange-400">Shop / Office Photo</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Shows as the big banner at top of your profile.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <button type="button"
                                onClick={() => profileData.shopImage && setPreviewGallery({ images: [profileData.shopImage], index: 0 })}
                                className={`w-16 h-16 rounded-xl bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-200 dark:border-orange-800 overflow-hidden flex items-center justify-center ${profileData.shopImage ? "cursor-pointer" : ""}`}>
                                {profileData.shopImage ? (
                                  <img src={profileData.shopImage} alt="Shop" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = ""; }} />
                                ) : (
                                  <Store className="w-7 h-7 text-orange-400" />
                                )}
                              </button>
                              {profileData.shopImage && (
                                <button type="button" onClick={() => { upd("shopImage", ""); patchProfile({ shopImage: null }); }}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow"><X className="w-3 h-3" /></button>
                              )}
                            </div>
                            <div className="flex-1">
                              <input ref={shopPhotoInput} type="file" accept="image/*" className="hidden"
                                onChange={(e) => { const file = e.target.files?.[0]; if (file) setPendingAdjust({ file, type: "shop" }); e.target.value = ""; }} />
                              <button type="button" onClick={() => shopPhotoInput.current?.click()} disabled={isCompressingShop || shopPhotoUpload.isUploading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors disabled:opacity-60">
                                {isCompressingShop ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : shopPhotoUpload.isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> {shopPhotoUpload.progress}%</> : profileData.shopImage ? <><Store className="w-4 h-4" /> Change</> : <><Upload className="w-4 h-4" /> Upload Photo</>}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="px-5 py-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">
                              <span className="text-base font-black">3</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-green-700 dark:text-green-400">Work Photos (Before/After)</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Gallery of your actual work.</p>
                            </div>
                          </div>
                          <input ref={workPhotoInput} type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) setPendingAdjust({ file, type: "work" }); e.target.value = ""; }} />
                          <button type="button" onClick={() => workPhotoInput.current?.click()} disabled={isCompressingWork || workPhotoUpload.isUploading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60">
                            {isCompressingWork ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : workPhotoUpload.isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> {workPhotoUpload.progress}%</> : <><Plus className="w-4 h-4" /> Add Work Photo</>}
                          </button>
                          {profileData.workImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              {profileData.workImages.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded-xl overflow-hidden group border-2 border-green-200 dark:border-green-800">
                                  <button type="button" onClick={() => setPreviewGallery({ images: profileData.workImages, index: i })} className="w-full h-full">
                                    <img src={url} alt={`Work ${i + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/200x200?text=img"; }} />
                                  </button>
                                  <button type="button" onClick={() => { const u = profileData.workImages.filter((_, j) => j !== i); setProfileData(p => ({ ...p, workImages: u })); patchProfile({ workImages: u }); }}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><X className="w-3 h-3" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {!profileData.city.trim() && (
                      <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-2xl px-4 py-3 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>Enter your city above — it's required to get listed.</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {profileSlug && (
                        <button type="button" onClick={() => setEditingProfile(false)}
                          className="flex-1 py-4 rounded-2xl font-semibold text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                          Cancel
                        </button>
                      )}
                      <button type="button"
                        onClick={profileSlug ? handleSaveProfile : handleCreateProfile}
                        disabled={profileSaving || creatingProfile || !profileData.city.trim()}
                        className={`flex-1 py-4 rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50
                          ${profileSaved ? "bg-green-500 text-white" : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"}`}>
                        {(profileSaving || creatingProfile) ? <Loader2 className="w-4 h-4 animate-spin" />
                          : profileSaved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                          : profileSlug ? <><Save className="w-4 h-4" /> Save Profile</>
                          : <><Search className="w-4 h-4" /> Go Live on Google</>}
                      </button>
                    </div>
                  </div>
                )}

                {directoryEnabled && !profileSlug && (
                  <div className="space-y-4">
                    <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm space-y-4">
                      <CardHeader icon={<MapPin className="w-5 h-5" />} title="Your City *"
                        subtitle="Required to get you listed" editing={true} />
                      <Field label="City">
                        <input type="text" placeholder="e.g. Mumbai" className={inp}
                          value={profileData.city} onChange={e => upd("city", e.target.value)} />
                      </Field>
                    </div>
                    {!profileData.city.trim() && (
                      <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-2xl px-4 py-3 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>Enter your city above — it's required to get listed.</p>
                      </div>
                    )}
                    <button type="button"
                      onClick={handleCreateProfile}
                      disabled={creatingProfile || !profileData.city.trim()}
                      className="w-full py-4 rounded-2xl font-bold text-sm shadow-md bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-center gap-2 disabled:opacity-50">
                      {creatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Go Live on Google</>}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── TAB: MESSAGES ── */}
            {activeTab === "messages" && (
              <>
                <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                  <CardHeader icon={<Star className="w-5 h-5 text-amber-500" />}
                    title="Google Review Link"
                    subtitle="Included in every review request you send"
                    onEdit={() => setEditingMessages(true)}
                    editing={editingMessages}
                  />
                  {editingMessages ? (
                    <Field label="Review Link">
                      <input type="url" placeholder="https://g.page/r/..." className={inp}
                        value={formData.reviewLink} onChange={e => setFormData({ ...formData, reviewLink: e.target.value })} />
                      <p className="text-xs text-muted-foreground mt-1">Find this in Google My Business → Get more reviews.</p>
                    </Field>
                  ) : (
                    <ViewRow label="Review Link" value={formData.reviewLink || "Not set"} />
                  )}
                </div>

                <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                  <CardHeader icon={<MessageSquare className="w-5 h-5" />}
                    title="Message Templates"
                    subtitle="Sent via WhatsApp to your customers"
                    onEdit={() => setEditingMessages(true)}
                    editing={editingMessages}
                  />
                  {editingMessages ? (
                    <form onSubmit={handleMsgSave} className="space-y-4">
                      <Field label="Reminder Message">
                        <textarea rows={3} className={`${inp} resize-none`}
                          value={formData.defaultReminderMessage}
                          onChange={e => setFormData({ ...formData, defaultReminderMessage: e.target.value })} />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use <code className="bg-muted px-1 py-0.5 rounded text-[11px]">[Name]</code> and <code className="bg-muted px-1 py-0.5 rounded text-[11px]">[ServiceType]</code> as placeholders.
                        </p>
                      </Field>
                      <Field label="Review Request Message">
                        <textarea rows={3} className={`${inp} resize-none`}
                          value={formData.defaultReviewMessage}
                          onChange={e => setFormData({ ...formData, defaultReviewMessage: e.target.value })} />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use <code className="bg-muted px-1 py-0.5 rounded text-[11px]">[Review Link]</code> as a placeholder.
                        </p>
                      </Field>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setEditingMessages(false)}
                          className="flex-1 py-3.5 rounded-2xl font-semibold text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                          Cancel
                        </button>
                        <button type="submit" disabled={updateBusiness.isPending}
                          className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-primary to-secondary text-white shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                          {updateBusiness.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-0.5">
                      <ViewRow label="Reminder" value={formData.defaultReminderMessage} />
                      <ViewRow label="Review Request" value={formData.defaultReviewMessage} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── TAB: LANGUAGE ── */}
            {activeTab === "language" && (
              <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{t("settings.language")}</h3>
                    <p className="text-xs text-muted-foreground">{t("language.switch_prompt")}</p>
                  </div>
                </div>
                <LanguageSwitcher />
              </div>
            )}

          </div>
        )}
      </div>
      {pendingAdjust && (
        <ImageAdjustModal
          pending={pendingAdjust}
          onCancel={() => setPendingAdjust(null)}
          onConfirm={async (adjustedFile) => {
            const type = pendingAdjust.type;
            setPendingAdjust(null);
            if (type === "profile") {
              setIsCompressingPic(true);
              const c = await compressImage(adjustedFile, 800, 0.85);
              setIsCompressingPic(false);
              await profilePicUpload.uploadFile(c);
            } else if (type === "shop") {
              setIsCompressingShop(true);
              const c = await compressImage(adjustedFile, 1200, 0.85);
              setIsCompressingShop(false);
              await shopPhotoUpload.uploadFile(c);
            } else {
              setIsCompressingWork(true);
              const c = await compressImage(adjustedFile, 1200, 0.82);
              setIsCompressingWork(false);
              await workPhotoUpload.uploadFile(c);
            }
          }}
        />
      )}
      {/* Full-screen image gallery preview */}
      {previewGallery && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex flex-col" onClick={() => setPreviewGallery(null)}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 flex-shrink-0">
            <span className="text-white/60 text-sm font-medium">
              {previewGallery.images.length > 1 ? `${previewGallery.index + 1} / ${previewGallery.images.length}` : ""}
            </span>
            <button className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              onClick={() => setPreviewGallery(null)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-4 pb-4 relative" onClick={e => e.stopPropagation()}>
            <img src={previewGallery.images[previewGallery.index]} alt="Preview"
              className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl" />
            {/* Navigation arrows */}
            {previewGallery.images.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setPreviewGallery(g => g ? { ...g, index: (g.index - 1 + g.images.length) % g.images.length } : null); }}
                  className="absolute left-2 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={e => { e.stopPropagation(); setPreviewGallery(g => g ? { ...g, index: (g.index + 1) % g.images.length } : null); }}
                  className="absolute right-2 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-colors">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
          {/* Thumbnail strip for multiple images */}
          {previewGallery.images.length > 1 && (
            <div className="flex gap-2 px-4 pb-6 overflow-x-auto flex-shrink-0" onClick={e => e.stopPropagation()}>
              {previewGallery.images.map((url, i) => (
                <button key={i} onClick={() => setPreviewGallery(g => g ? { ...g, index: i } : null)}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-colors ${i === previewGallery.index ? "border-white" : "border-white/20"}`}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </MobileLayout>
  );
}
