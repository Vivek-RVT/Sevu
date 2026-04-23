import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useCreateBusiness } from "@workspace/api-client-react";
import { useBusinessId, useAuthPhone } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  ArrowRight, ArrowLeft, Store, Loader2, Phone, LogIn, Eye, EyeOff,
  AlertCircle, Globe, Clock, MapPin, DollarSign, Wrench, BadgeCheck,
  CheckCircle2, Lock, KeyRound, RotateCcw, ChevronRight, Search,
  Instagram, Link, MessageCircle, Tag, Zap, Scissors, Wind,
  FlaskConical, Hammer, Sparkles, Filter, Plus, Check, Pencil,
  User, Briefcase,
} from "lucide-react";
import { CATEGORY_CONFIG, JOB_TYPE_ICONS } from "@/lib/categoryConfig";
import { LANGUAGES, getSmartPriority, changeLanguage, type SupportedLang } from "@/lib/i18n";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Salon / Barbershop", "Gym / Fitness", "Spa / Wellness", "Plumber",
  "Electrician", "Doctor / Clinic", "Dentist", "Lab / Diagnostics", "Tailor",
  "AC Repair", "Car Mechanic", "Bike Repair", "Home Cleaning",
  "Painter", "Carpenter", "RO / Water Filter", "Real Estate",
  "Interior Designer", "CCTV Installation", "Solar Panel", "Laptop Repair",
  "Tutor", "Photographer", "Makeup Artist", "Event Planner", "Other",
];

const CATEGORY_SERVICE_LABEL: Record<string, string> = {
  "Salon / Barbershop": "Services Offered", "Gym / Fitness": "Facilities / Classes",
  "Spa / Wellness": "Treatments Offered", "Plumber": "Specializations",
  "Electrician": "Services Offered", "Doctor / Clinic": "Specialization / OPD",
  "Dentist": "Dental Services", "Lab / Diagnostics": "Tests Available", "Tailor": "Tailoring Speciality",
  "AC Repair": "Services Offered", "Car Mechanic": "Specializations",
  "Bike Repair": "Specializations", "Home Cleaning": "Services Offered",
  "Painter": "Services Offered", "Carpenter": "Specializations",
  "RO / Water Filter": "Services Offered", "Real Estate": "Services Offered",
  "Interior Designer": "Services Offered", "CCTV Installation": "Services Offered",
  "Solar Panel": "Services Offered", "Laptop Repair": "Services Offered",
  "Tutor": "Subjects / Levels", "Photographer": "Specializations",
  "Makeup Artist": "Services Offered", "Event Planner": "Event Types",
  "Other": "Services Offered",
};

const CATEGORY_SERVICES: Record<string, string> = {
  "Salon / Barbershop": "Haircut, Shave, Color, Blowdry, Facial...",
  "Gym / Fitness": "Weight training, Zumba, Yoga, CrossFit...",
  "Spa / Wellness": "Massage, Facials, Body wraps, Aromatherapy...",
  "Plumber": "Pipe repair, Leak fixing, Bathroom fitting...",
  "Electrician": "Wiring, Panel upgrades, Lighting, CCTV...",
  "Doctor / Clinic": "General medicine, Mon-Sat 9am-6pm...",
  "Dentist": "Cleaning, Root canal, Braces, Implants...",
  "Lab / Diagnostics": "CBC, Thyroid, Blood sugar, Lipid profile, Home collection...",
  "Tailor": "Wedding wear, Alterations, Suits, Blouses...",
  "AC Repair": "AC service, Gas refill, Installation, Repair...",
  "Car Mechanic": "Engine repair, Denting, Painting, Service...",
  "Bike Repair": "Engine repair, Tyre change, Chain, Servicing...",
  "Home Cleaning": "Deep cleaning, Sofa cleaning, Kitchen, Bathroom...",
  "Painter": "Interior painting, Exterior, Texture, Waterproofing...",
  "Carpenter": "Furniture repair, Modular, Doors, Cabinets...",
  "RO / Water Filter": "RO installation, Filter change, Repair, AMC...",
  "Real Estate": "Buy, Sell, Rent, Property management, Valuation...",
  "Interior Designer": "Home design, Office, Modular kitchen, 3D design...",
  "CCTV Installation": "CCTV setup, DVR/NVR, Maintenance, Monitoring...",
  "Solar Panel": "Solar installation, Inverter, Maintenance, AMC...",
  "Laptop Repair": "Screen repair, Keyboard, Software, Data recovery...",
  "Tutor": "Maths, Science, English, IIT-JEE, NEET, Board exams...",
  "Photographer": "Wedding, Portrait, Product, Events, Baby shoot...",
  "Makeup Artist": "Bridal, Party, HD makeup, Hairstyling...",
  "Event Planner": "Wedding, Birthday, Corporate, Decoration, Catering...",
  "Other": "List your key services here...",
};

const CATEGORY_HOURS: Record<string, { label: string; value: string }[]> = {
  Plumber:            [{ label: "Mon–Sat: 9am–8pm", value: "Mon–Sat: 9am–8pm" }, { label: "Mon–Sun: 10am–9pm", value: "Mon–Sun: 10am–9pm" }, { label: "24/7 Emergency", value: "Daily: 24 Hours (Emergency)" }],
  Electrician:        [{ label: "Mon–Sat: 9am–8pm", value: "Mon–Sat: 9am–8pm" }, { label: "Mon–Sun: 10am–9pm", value: "Mon–Sun: 10am–9pm" }, { label: "24/7 Emergency", value: "Daily: 24 Hours (Emergency)" }],
  "AC Repair":        [{ label: "Mon–Sat: 9am–8pm", value: "Mon–Sat: 9am–8pm" }, { label: "Mon–Sun: 10am–9pm", value: "Mon–Sun: 10am–9pm" }, { label: "24/7 Emergency", value: "Daily: 24 Hours (Emergency)" }],
  Salon:              [{ label: "Mon–Sat: 10am–8pm", value: "Mon–Sat: 10am–8pm" }, { label: "Mon–Sun: 10am–9pm", value: "Mon–Sun: 10am–9pm" }, { label: "Closed Tuesday", value: "Mon, Wed–Sun: 10am–8pm (Closed Tue)" }],
  Cleaning:           [{ label: "Mon–Sat: 8am–6pm", value: "Mon–Sat: 8am–6pm" }, { label: "Mon–Fri: 8am–6pm", value: "Mon–Fri: 8am–6pm" }],
  "Diagnostic Labs":  [{ label: "Mon–Sat: 7am–7pm", value: "Mon–Sat: 7am–7pm" }, { label: "Sun Half-Day", value: "Mon–Sat: 7am–7pm, Sun: 8am–1pm" }],
  Carpenter:          [{ label: "Mon–Sat: 9am–7pm", value: "Mon–Sat: 9am–7pm" }, { label: "Mon–Sun: 9am–6pm", value: "Mon–Sun: 9am–6pm" }],
  "RO Repair":        [{ label: "Mon–Sat: 9am–8pm", value: "Mon–Sat: 9am–8pm" }, { label: "Mon–Sun: 10am–9pm", value: "Mon–Sun: 10am–9pm" }],
};

const DEFAULT_HOURS: Record<string, string> = {
  Plumber: "Mon–Sat: 9am–8pm", Electrician: "Mon–Sat: 9am–8pm", "AC Repair": "Mon–Sat: 9am–8pm",
  Salon: "Mon–Sat: 10am–8pm", Cleaning: "Mon–Sat: 8am–6pm", "Diagnostic Labs": "Mon–Sat: 7am–7pm",
  Carpenter: "Mon–Sat: 9am–7pm", "RO Repair": "Mon–Sat: 9am–8pm",
};

const GENERIC_HOURS = [
  { label: "Mon–Sat: 9am–8pm", value: "Mon–Sat: 9am–8pm" },
  { label: "Mon–Sun: 10am–9pm", value: "Mon–Sun: 10am–9pm" },
  { label: "Mon–Fri: 8am–6pm", value: "Mon–Fri: 8am–6pm" },
  { label: "Daily: 24 Hours", value: "Daily: 24 Hours" },
  { label: "Closed Sunday", value: "Mon–Sat: 9am–8pm (Closed Sun)" },
];

const CATEGORY_SECTIONS = [
  {
    label: "Popular Services",
    emoji: "🔥",
    items: [
      { value: "Plumber", label: "Plumber", Icon: Wrench },
      { value: "Electrician", label: "Electrician", Icon: Zap },
      { value: "AC Repair", label: "AC Repair", Icon: Wind },
      { value: "Salon / Barbershop", label: "Salon", Icon: Scissors },
      { value: "Lab / Diagnostics", label: "Diagnostic Labs", Icon: FlaskConical },
    ],
  },
  {
    label: "Home Services",
    emoji: "🏠",
    items: [
      { value: "Carpenter", label: "Carpenter", Icon: Hammer },
      { value: "Home Cleaning", label: "Cleaning", Icon: Sparkles },
      { value: "RO / Water Filter", label: "RO Repair", Icon: Filter },
    ],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "welcome"
  | "phone"
  | "verify-otp"
  | "choose-language"  // shown after OTP verify, before password creation
  | "create-password"
  | "login-password"
  | "forgot-reset"   // Enter OTP + new password (combined screen)
  | "setup"
  | "success";

// ─── Shared UI ────────────────────────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder, label }: {
  value: string; onChange: (v: string) => void; placeholder?: string; label: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder || "••••••••"}
          className="w-full pl-11 pr-12 py-3.5 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium mb-6 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );
}

// ─── Language Picker (shown once after OTP) ───────────────────────────────────

function ChooseLanguageScreen({
  onContinue, cardCls, primaryBtn,
}: { onContinue: () => void; cardCls: string; primaryBtn: string }) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<SupportedLang>(
    (i18n.language as SupportedLang) || "en"
  );
  const [showAll, setShowAll] = useState(false);

  const prioritized = getSmartPriority(selected);
  const visible = showAll ? LANGUAGES : prioritized.slice(0, 3);

  const handlePick = (code: SupportedLang) => {
    setSelected(code);
    changeLanguage(code);
  };

  return (
    <motion.div
      key="choose-language"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      className={cardCls}
    >
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary mx-auto">
          <Globe className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-display font-bold">{t("language.switch_prompt")}</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {t("language.detected")} — {t("common.or").toLowerCase()} pick yours below
        </p>
      </div>

      <div className="space-y-2.5 mb-4">
        {visible.map((lang) => {
          const isActive = selected === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handlePick(lang.code)}
              className={[
                "flex items-center justify-between w-full px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.98]",
                isActive
                  ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/10"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold leading-none">{lang.nativeLabel}</span>
                {lang.label !== lang.nativeLabel && (
                  <span className="text-xs text-muted-foreground font-normal">{lang.label}</span>
                )}
              </div>
              <div className={[
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                isActive ? "border-primary bg-primary" : "border-border",
              ].join(" ")}>
                {isActive && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5 mx-auto"
      >
        {showAll ? t("settings.fewer_languages") : `${t("settings.more_languages")} (${LANGUAGES.length - 3})`}
      </button>

      <button type="button" onClick={onContinue} className={primaryBtn}>
        {t("common.confirm")} & Continue <ArrowRight className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const [_, setLocation] = useLocation();

  const [screen, setScreen] = useState<Screen>("phone");

  const { setBusinessId } = useBusinessId();
  const { setAuthenticated } = useAuth();
  const { setPhone: setStoredPhone } = useAuthPhone();
  const createBusiness = useCreateBusiness();

  // Shared auth state — pre-fill phone from storage when resuming mid-flow, default to +91 prefix
  const [phone, setPhone] = useState(() => localStorage.getItem("sevuAuthPhone") || "+91 ");

  /** Keep the +91 prefix locked — user can only edit the digits after it. */
  const handlePhoneChange = (val: string) => {
    const PREFIX = "+91 ";
    if (!val.startsWith(PREFIX)) {
      setPhone(PREFIX);
      return;
    }
    const afterPrefix = val.slice(PREFIX.length);
    const digitsOnly = afterPrefix.replace(/\D/g, "").slice(0, 10);
    setPhone(PREFIX + digitsOnly);
  };
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [regOtp, setRegOtp] = useState(""); // OTP that passed peek-verify, submitted with register
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [testOtp, setTestOtp] = useState<string | null>(null); // hint from test mode

  // Business setup state
  const [bizData, setBizData] = useState({
    ownerName: "", name: "", category: "", city: "", address: "", description: "",
    priceRange: "", servicesOffered: "", yearsExperience: "", certifications: "",
    openingHours: "", website: "", instagram: "", whatsapp: "",
    isAvailable24x7: false, getListedOnDirectory: true,
    selectedServices: [] as string[], jobType: "",
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bizSubmitting, setBizSubmitting] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [otherCategory, setOtherCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);

  const clearError = () => setError("");
  const go = (s: Screen) => { setError(""); setScreen(s); };

  // ── Screen: phone entry ────────────────────────────────────────────────────

  const validatePhone = (val: string): string | null => {
    const digits = val.replace(/\D/g, "");
    const mobile = digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits.length === 10 ? digits : null;
    if (!mobile) return "Please enter a valid 10-digit Indian mobile number.";
    if (!/^[6-9]\d{9}$/.test(mobile)) return "Number must start with 6, 7, 8, or 9.";
    return null;
  };

  const handleCheckPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneError = validatePhone(phone);
    if (phoneError) { setError(phoneError); return; }
    setLoading(true); clearError();
    try {
      const res = await fetch("/api/auth/check-phone", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }

      if (!data.isNewUser) {
        // Existing user → go straight to password
        go("login-password");
        return;
      }

      // New user → send OTP first, then verify before setting password
      const otpRes = await fetch("/api/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) { setError(otpData.error || "Could not send OTP. Please try again."); return; }
      setTestOtp(otpData.otp || null);
      setOtp("");
      go("verify-otp");
    } catch {
      setError("Connection failed. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Screen: create-password (register) ────────────────────────────────────

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password.length > 72) { setError("Password is too long (max 72 characters)."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!regOtp) { setError("Phone verification missing. Please go back and verify your number."); return; }
    setLoading(true); clearError();
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: regOtp, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed."); return; }
      setAuthenticated(null);
      setStoredPhone(phone.trim());
      setRegOtp("");
      go("setup");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Screen: verify-otp (registration phone verify) ────────────────────────

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) { setError("Please enter the 6-digit OTP."); return; }
    setLoading(true); clearError();
    try {
      // Peek-validate — confirms OTP is correct without consuming it
      const res = await fetch("/api/auth/check-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "OTP verification failed."); return; }
      // Store the verified OTP to pass along to register
      setRegOtp(otp.trim());
      setTestOtp(null);
      setPassword("");
      setConfirmPassword("");
      go("choose-language");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true); clearError();
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not resend OTP."); return; }
      setTestOtp(data.otp || null);
      setOtp("");
    } catch {
      setError("Could not resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Screen: login-password ─────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError("Please enter your password."); return; }
    setLoading(true); clearError();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed."); return; }
      setAuthenticated(data.business?.id ?? null);
      setStoredPhone(phone.trim());
      if (data.business?.id) {
        setBusinessId(data.business.id);
        setLocation("/app/dashboard");
      } else {
        go("setup");
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Screen: forgot-reset ───────────────────────────────────────────────────

  const handleSendForgotOtp = async () => {
    setLoading(true); clearError();
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not send OTP."); return; }
      setTestOtp(data.otp || null);
      go("forgot-reset");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) { setError("Please enter the 6-digit OTP."); return; }
    if (newPassword.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (newPassword.length > 72) { setError("Password is too long (max 72 characters)."); return; }
    if (newPassword !== confirmNewPassword) { setError("Passwords do not match."); return; }
    setLoading(true); clearError();
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not reset password."); return; }
      setAuthenticated(data.business?.id ?? null);
      setStoredPhone(phone.trim());
      setTestOtp(null); setOtp(""); setNewPassword(""); setConfirmNewPassword("");
      if (data.business?.id) {
        setBusinessId(data.business.id);
        setLocation("/app/dashboard");
      } else {
        go("setup");
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Screen: business setup ─────────────────────────────────────────────────

  const handleBizSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!bizData.ownerName || !bizData.name || !bizData.category) return;
    setBizSubmitting(true);
    try {
      const res = await createBusiness.mutateAsync({
        data: { ownerName: bizData.ownerName || undefined, name: bizData.name, category: bizData.category, phone: phone.trim() || undefined, address: bizData.address || undefined },
      });
      const businessId = res.id;
      setBusinessId(businessId);

      // Link business to auth user (requires JWT from in-memory context)
      await fetch("/api/auth/link-business", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      // Create directory profile if opted in
      if (bizData.getListedOnDirectory && bizData.city) {
        await fetch("/api/profiles", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId, name: bizData.name, service: bizData.category, city: bizData.city,
            phone: phone.trim() || "N/A", address: bizData.address || undefined,
            description: bizData.description || undefined, priceRange: bizData.priceRange || undefined,
            servicesOffered: [...bizData.selectedServices, ...(bizData.servicesOffered.trim() ? [bizData.servicesOffered.trim()] : [])].join(", ") || undefined, certifications: bizData.certifications || undefined,
            yearsExperience: bizData.yearsExperience ? parseInt(bizData.yearsExperience) : undefined,
            isAvailable24x7: bizData.isAvailable24x7, openingHours: bizData.openingHours || undefined,
            website: bizData.website || undefined, instagram: bizData.instagram || undefined,
            whatsapp: bizData.whatsapp || phone.trim() || undefined,
          }),
        }).catch(() => {});
      }

      setAuthenticated(businessId);
      setLocation("/app/dashboard");
    } catch (err) {
      console.error(err);
    } finally {
      setBizSubmitting(false);
    }
  };

  const upd = (k: keyof typeof bizData, v: string | boolean) => setBizData(d => ({ ...d, [k]: v }));

  // ── Render ─────────────────────────────────────────────────────────────────

  const cardCls = "bg-card rounded-3xl shadow-xl shadow-black/5 border border-border/50 p-6 sm:p-8";
  const inputCls = "w-full px-4 py-3.5 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium placeholder:text-muted-foreground/60";
  const primaryBtn = "w-full py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all flex items-center justify-center gap-2";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Background colour blobs */}
      <div className="absolute top-[-15%] left-[-15%] w-[55%] h-[55%] bg-primary/25 rounded-full blur-3xl" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[55%] h-[55%] bg-secondary/25 rounded-full blur-3xl" />
      <div className="absolute top-[30%] right-[-5%] w-[30%] h-[30%] bg-accent/15 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">

          {/* ── Welcome ── */}
          {screen === "welcome" && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -60 }}
              className="flex flex-col items-center text-center space-y-8">
              <div className="w-48 h-48 sm:w-56 sm:h-56">
                <img src={`${import.meta.env.BASE_URL}images/welcome-hero.png`} alt="Welcome to Sevu" className="w-full h-full object-contain drop-shadow-2xl" />
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-display font-extrabold tracking-tight">
                  Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Sevu</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                  Get more repeat customers & collect 5-star reviews effortlessly.
                </p>
              </div>
              <div className="w-full space-y-3">
                <button onClick={() => go("phone")}
                  className={primaryBtn}>
                  Get Started <ArrowRight className="w-5 h-5" />
                </button>
                <button onClick={() => go("phone")}
                  className="w-full px-8 py-3.5 border-2 border-border text-foreground rounded-2xl font-semibold hover:bg-muted active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" /> Already on Sevu? Login
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Phone Entry ── */}
          {screen === "phone" && (
            <motion.div key="phone" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -60 }}
              className={cardCls}>
              <div className="flex flex-col items-center text-center mb-8">
                <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Sevu" className="w-16 h-16 object-contain mb-4 drop-shadow-md" />
                <h1 className="text-3xl font-display font-extrabold tracking-tight">
                  Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Sevu</span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm max-w-xs">
                  Enter your phone number to get started or sign in to your account.
                </p>
              </div>
              <form onSubmit={handleCheckPhone} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                    <input type="tel" required inputMode="numeric" placeholder="+91 98765 43210"
                      maxLength={15}
                      className="w-full pl-11 pr-4 py-3.5 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium placeholder:text-muted-foreground/60"
                      value={phone} onChange={e => { handlePhoneChange(e.target.value); clearError(); }} />
                  </div>
                </div>
                {error && <ErrorBox message={error} />}
                <button type="submit" disabled={loading || phone.replace(/\D/g, "").length < 12} className={primaryBtn}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Create Password (New User) ── */}
          {screen === "create-password" && (
            <motion.div key="create-password" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
              className={cardCls}>
              <BackButton onClick={() => go("verify-otp")} />
              <div className="mb-6">
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center mb-4 text-green-600">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-bold">Create your password</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Creating account for <span className="font-semibold text-foreground">{phone}</span>
                </p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <PasswordInput label="New Password" value={password} onChange={v => { setPassword(v); clearError(); }} placeholder="Min. 8 characters" />
                <PasswordInput label="Confirm Password" value={confirmPassword} onChange={v => { setConfirmPassword(v); clearError(); }} placeholder="Repeat password" />
                {error && <ErrorBox message={error} />}
                <button type="submit" disabled={loading || !password || !confirmPassword} className={primaryBtn}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create Account <ArrowRight className="w-5 h-5" /></>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Verify OTP (registration phone verify) ── */}
          {screen === "verify-otp" && (
            <motion.div key="verify-otp" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
              className={cardCls}>
              <BackButton onClick={() => go("phone")} />
              <div className="mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-bold">Verify your phone</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  We sent a 6-digit code to <span className="font-semibold text-foreground">{phone}</span>
                </p>
                {testOtp && (
                  <div className="mt-3 flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Test mode — OTP: <strong>{testOtp}</strong></span>
                  </div>
                )}
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="• • • • • •"
                    className={`${inputCls} text-center tracking-[0.5em] text-xl`}
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); clearError(); }}
                  />
                </div>
                {error && <ErrorBox message={error} />}
                <button type="submit" disabled={loading || otp.length !== 6} className={primaryBtn}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-5 h-5" /></>}
                </button>
                <button type="button" onClick={handleResendOtp} disabled={loading}
                  className="w-full py-2.5 text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" /> Resend OTP
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Choose Language (shown once after OTP, before password setup) ── */}
          {screen === "choose-language" && (
            <ChooseLanguageScreen onContinue={() => go("create-password")} cardCls={cardCls} primaryBtn={primaryBtn} />
          )}

          {/* ── Login Password ── */}
          {screen === "login-password" && (
            <motion.div key="login-password" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
              className={cardCls}>
              <BackButton onClick={() => go("phone")} />
              <div className="mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
                  <LogIn className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-bold">Welcome back!</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Logging in as <span className="font-semibold text-foreground">{phone}</span>
                </p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <PasswordInput label="Password" value={password} onChange={v => { setPassword(v); clearError(); }} />
                {error && <ErrorBox message={error} />}
                <button type="submit" disabled={loading || !password} className={primaryBtn}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Login <ArrowRight className="w-5 h-5" /></>}
                </button>
                <button type="button"
                  onClick={handleSendForgotOtp}
                  disabled={loading}
                  className="w-full py-2.5 text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                  <KeyRound className="w-3.5 h-3.5" /> Forgot password? Reset via OTP
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Forgot Password: OTP + New Password ── */}
          {screen === "forgot-reset" && (
            <motion.div key="forgot-reset" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
              className={cardCls}>
              <BackButton onClick={() => go("login-password")} />
              <div className="mb-6">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4 text-orange-600">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-display font-bold">Reset Password</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  OTP sent to <span className="font-semibold text-foreground">{phone}</span>
                </p>
                {testOtp && (
                  <div className="mt-3 flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Test mode — OTP: <strong>{testOtp}</strong></span>
                  </div>
                )}
              </div>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Enter 6-Digit OTP</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} placeholder="• • • • • •"
                    className={`${inputCls} text-center tracking-[0.5em] text-xl`}
                    value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); clearError(); }}
                  />
                </div>
                <PasswordInput label="New Password" value={newPassword} onChange={v => { setNewPassword(v); clearError(); }} placeholder="Min. 8 characters" />
                <PasswordInput label="Confirm New Password" value={confirmNewPassword} onChange={v => { setConfirmNewPassword(v); clearError(); }} />
                {error && <ErrorBox message={error} />}
                <button type="submit" disabled={loading || otp.length !== 6 || !newPassword || !confirmNewPassword} className={primaryBtn}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Set New Password & Login <ArrowRight className="w-5 h-5" /></>}
                </button>
                <button type="button" onClick={handleSendForgotOtp} disabled={loading}
                  className="w-full py-2.5 text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" /> Resend OTP
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Business Setup (4-step wizard) ── */}
          {screen === "setup" && (() => {
            const STEPS = [
              { label: "Basics",   icon: <Store className="w-4 h-4" /> },
              { label: "Location", icon: <MapPin className="w-4 h-4" /> },
              { label: "Services", icon: <Wrench className="w-4 h-4" /> },
              { label: "Go Live",  icon: <Search className="w-4 h-4" /> },
            ];

            const inp = "w-full px-4 py-3.5 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium placeholder:text-muted-foreground/60 text-sm";

            return (
              <motion.div key="setup" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
                className={cardCls}>

                {/* Step indicator */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    {STEPS.map((s, i) => {
                      const n = i + 1;
                      const done = n < setupStep;
                      const active = n === setupStep;
                      return (
                        <div key={n} className="flex flex-col items-center gap-1 flex-1">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                            ${done ? "bg-green-500 text-white" : active ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground"}`}>
                            {done ? <CheckCircle2 className="w-4.5 h-4.5" /> : n}
                          </div>
                          <span className={`text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                          {i < STEPS.length - 1 && (
                            <div className="absolute" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                      style={{ width: `${((setupStep - 1) / (STEPS.length - 1)) * 100}%` }} />
                  </div>
                </div>

                {/* ── Step 1: Business Basics ── */}
                {setupStep === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-xl font-display font-bold">Your business basics</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Name and type — this is how customers find you.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" /> Owner Full Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                          <input type="text" placeholder="e.g. Rajesh Kumar" className={`${inp} pl-10`}
                            value={bizData.ownerName} onChange={e => upd("ownerName", e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Business Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                          <input type="text" placeholder="e.g. Bella's Salon" className={`${inp} pl-10`}
                            value={bizData.name} onChange={e => upd("name", e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">Business Type <span className="text-red-500">*</span></label>

                        {/* Trigger button */}
                        <button
                          type="button"
                          onClick={() => setCategoryOpen(true)}
                          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                            bizData.category
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:border-primary/40"
                          }`}
                        >
                          {bizData.category ? (
                            <div className="flex items-center gap-2.5">
                              {(() => {
                                const all = CATEGORY_SECTIONS.flatMap(s => s.items);
                                const match = all.find(i => i.value === bizData.category);
                                return match
                                  ? <><match.Icon className="w-4 h-4 text-primary" /><span className="font-semibold text-foreground text-sm">{match.label}</span></>
                                  : <><Plus className="w-4 h-4 text-primary" /><span className="font-semibold text-foreground text-sm">{bizData.category}</span></>;
                              })()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 text-sm font-medium">Choose your business type...</span>
                          )}
                          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${bizData.category ? "text-primary" : "text-muted-foreground"}`} />
                        </button>

                        {/* If "Other" is selected — show text input inline */}
                        {bizData.category && !CATEGORY_SECTIONS.flatMap(s => s.items).find(i => i.value === bizData.category) && (
                          <input
                            type="text"
                            autoFocus
                            placeholder="e.g. Solar Panel, Tutor, Photographer..."
                            className={inp}
                            value={otherCategory}
                            onChange={e => {
                              setOtherCategory(e.target.value);
                              if (e.target.value) setBizData(d => ({ ...d, category: e.target.value }));
                            }}
                          />
                        )}
                      </div>

                      {/* ── Category Picker Modal ── */}
                      {categoryOpen && (
                        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                          {/* Backdrop */}
                          <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setCategoryOpen(false)}
                          />
                          {/* Sheet */}
                          <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border/50 overflow-hidden">
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-1 sm:hidden">
                              <div className="w-10 h-1 rounded-full bg-border" />
                            </div>

                            <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-border/40">
                              <div>
                                <p className="font-bold text-base">Select Business Type</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Choose the one that best fits you</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setCategoryOpen(false)}
                                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Plus className="w-4 h-4 rotate-45" />
                              </button>
                            </div>

                            <div className="px-5 py-4 space-y-5 max-h-[65vh] overflow-y-auto">
                              {CATEGORY_SECTIONS.map(section => (
                                <div key={section.label}>
                                  <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest mb-2.5">
                                    {section.emoji} {section.label}
                                  </p>
                                  <div className="space-y-1.5">
                                    {section.items.map(({ value, label, Icon }) => {
                                      const selected = bizData.category === value;
                                      return (
                                        <button
                                          key={value}
                                          type="button"
                                          onClick={() => {
                                            const cfg = CATEGORY_CONFIG[value];
                                            setBizData(d => ({ ...d, category: value, selectedServices: [], servicesOffered: "", jobType: cfg?.jobTypes?.[0] || "", openingHours: d.openingHours || DEFAULT_HOURS[value] || "" }));
                                            setOtherCategory("");
                                            setCategoryOpen(false);
                                          }}
                                          className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-150 text-left ${
                                            selected
                                              ? "border-primary bg-primary/8 text-primary"
                                              : "border-border bg-background hover:bg-muted/60 hover:border-border text-foreground"
                                          }`}
                                        >
                                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selected ? "bg-primary/15" : "bg-muted"}`}>
                                            <Icon className={`w-4.5 h-4.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                                          </div>
                                          <span className="text-sm font-semibold flex-1">{label}</span>
                                          {selected && (
                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                              <Check className="w-3 h-3 text-white" />
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}

                              {/* Other */}
                              <div>
                                <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest mb-2.5">➕ Other</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBizData(d => ({ ...d, category: "Other", selectedServices: [], servicesOffered: "", jobType: "" }));
                                    setOtherCategory("");
                                    setCategoryOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl border border-dashed transition-all text-left ${
                                    bizData.category === "Other"
                                      ? "border-primary bg-primary/8 text-primary"
                                      : "border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bizData.category === "Other" ? "bg-primary/15" : "bg-muted"}`}>
                                    <Plus className={`w-4.5 h-4.5 ${bizData.category === "Other" ? "text-primary" : "text-muted-foreground"}`} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold">Other Service</p>
                                    <p className="text-xs opacity-70 mt-0.5">My service isn't listed above</p>
                                  </div>
                                  {bizData.category === "Other" && (
                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-muted-foreground" /> WhatsApp Number</label>
                        <div className="flex rounded-xl border-2 border-border bg-muted/40 overflow-hidden">
                          <span className="flex items-center px-3.5 text-sm font-bold text-foreground bg-muted border-r border-border select-none">+91</span>
                          <input
                            type="tel"
                            readOnly
                            disabled
                            className="flex-1 bg-transparent px-3.5 py-3 text-sm outline-none font-semibold text-foreground cursor-not-allowed"
                            value={(phone.replace(/^\+91\s?/, "").trim()) || ""}
                          />
                          <span className="flex items-center px-3 text-xs font-bold text-green-600 select-none">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 pl-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          Verified via OTP — cannot be changed
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => {
                      if (!bizData.ownerName || !bizData.name || !bizData.category) { setError("Please fill in owner name, business name and category."); return; }
                      setError(""); setSetupStep(2);
                    }}
                      className={primaryBtn}>
                      Continue <ArrowRight className="w-5 h-5" />
                    </button>
                    {error && <ErrorBox message={error} />}
                  </div>
                )}

                {/* ── Step 2: Location & Hours ── */}
                {setupStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <BackButton onClick={() => { setError(""); setSetupStep(1); }} />
                      <h2 className="text-xl font-display font-bold">Where are you located?</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Help customers find you and know when you're open.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> City</label>
                        <input type="text" placeholder="e.g. Mumbai" className={inp}
                          value={bizData.city} onChange={e => upd("city", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">Shop / Clinic Address</label>
                        <AddressAutocomplete value={bizData.address} onChange={address => upd("address", address)} placeholder="Search your exact address..." />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-sm font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Opening Hours
                        </label>

                        {/* Smart chips — category-specific or generic */}
                        {(() => {
                          const presets = CATEGORY_HOURS[bizData.category] || GENERIC_HOURS;
                          const isCustom = bizData.openingHours !== "" && !presets.some(p => p.value === bizData.openingHours);
                          return (
                            <>
                              {/* Section label */}
                              {CATEGORY_HOURS[bizData.category] && (
                                <p className="text-[11px] text-muted-foreground font-medium">
                                  Suggested for {bizData.category}
                                </p>
                              )}

                              {/* Preset chips */}
                              <div className="flex flex-wrap gap-2">
                                {presets.map(p => {
                                  const active = bizData.openingHours === p.value;
                                  return (
                                    <button
                                      key={p.value}
                                      type="button"
                                      onClick={() => upd("openingHours", p.value)}
                                      className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${
                                        active
                                          ? "bg-primary text-white border-primary shadow-sm"
                                          : "bg-muted border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                                      }`}
                                    >
                                      {active && <Check className="inline w-3 h-3 mr-1 -mt-px" />}{p.label}
                                    </button>
                                  );
                                })}

                                {/* Custom chip */}
                                <button
                                  type="button"
                                  onClick={() => { upd("openingHours", ""); setTimeout(() => (document.getElementById("hoursInput") as HTMLInputElement)?.focus(), 50); }}
                                  className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all flex items-center gap-1 ${
                                    isCustom
                                      ? "bg-primary text-white border-primary shadow-sm"
                                      : "bg-muted border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                                  }`}
                                >
                                  <Pencil className="w-3 h-3" /> Custom
                                </button>
                              </div>

                              {/* Text input — always visible; pre-filled from chips or type freely */}
                              <input
                                id="hoursInput"
                                type="text"
                                placeholder="e.g. Mon–Sat: 9am–8pm"
                                className={inp}
                                value={bizData.openingHours}
                                onChange={e => upd("openingHours", e.target.value)}
                              />
                              {isCustom && bizData.openingHours.trim().length < 5 && (
                                <p className="text-xs text-amber-500">Describe your hours, e.g. "Mon–Sat: 10am–7pm"</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex items-center justify-between py-3.5 px-4 bg-muted/50 rounded-xl border-2 border-border">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-sm">Available 24×7</p>
                            <p className="text-xs text-muted-foreground">Emergency / round-the-clock service</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => upd("isAvailable24x7", !bizData.isAvailable24x7)}
                          className={`relative w-12 h-6 rounded-full transition-colors ${bizData.isAvailable24x7 ? "bg-primary" : "bg-muted"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${bizData.isAvailable24x7 ? "translate-x-6" : ""}`} />
                        </button>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setError(""); setSetupStep(3); }} className={primaryBtn}>
                      Continue <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* ── Step 3: Services & Profile (Smart / Category-aware) ── */}
                {setupStep === 3 && (() => {
                  const cfg = CATEGORY_CONFIG[bizData.category];
                  const toggleService = (svc: string) => {
                    const current = bizData.selectedServices;
                    const next = current.includes(svc) ? current.filter(s => s !== svc) : [...current, svc];
                    setBizData(d => ({ ...d, selectedServices: next }));
                  };
                  return (
                    <div className="space-y-5">
                      <div>
                        <BackButton onClick={() => { setError(""); setSetupStep(2); }} />
                        <h2 className="text-xl font-display font-bold">What do you offer?</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Tell customers what makes you the best choice.</p>
                      </div>
                      <div className="space-y-4">

                        {/* ── Service chips ── */}
                        {cfg && (
                          <div className="space-y-2">
                            <label className="text-sm font-semibold flex items-center gap-1.5">
                              <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                              {cfg.serviceLabelPlural}
                              <span className="text-xs font-normal text-muted-foreground">(tap to select)</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {cfg.services.map(svc => {
                                const selected = bizData.selectedServices.includes(svc);
                                return (
                                  <button key={svc} type="button" onClick={() => toggleService(svc)}
                                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95
                                      ${selected ? "bg-primary text-white border-primary shadow-sm" : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>
                                    {selected ? "✓ " : ""}{svc}
                                  </button>
                                );
                              })}
                            </div>
                            {bizData.selectedServices.length > 0 && (
                              <p className="text-xs text-primary font-medium">{bizData.selectedServices.length} selected</p>
                            )}
                            <textarea rows={2}
                              placeholder={bizData.selectedServices.length > 0 ? "Add more services not listed above..." : "Type your services here, e.g. Haircut, Color, Blowdry..."}
                              className={`${inp} resize-none text-xs`}
                              value={bizData.servicesOffered}
                              onChange={e => upd("servicesOffered", e.target.value)} />
                          </div>
                        )}

                        {/* ── Job Type ── */}
                        {cfg && cfg.jobTypes.length > 1 && (
                          <div className="space-y-2">
                            <label className="text-sm font-semibold">How do you serve customers?</label>
                            <div className="flex flex-wrap gap-2">
                              {cfg.jobTypes.map(jt => (
                                <button key={jt} type="button" onClick={() => upd("jobType", jt)}
                                  className={`flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border font-semibold transition-all active:scale-95
                                    ${bizData.jobType === jt ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}>
                                  {JOB_TYPE_ICONS[jt]} {jt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Price ── */}
                        <div className="space-y-2">
                          <label className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> Price Range</label>
                          {cfg && (
                            <div className="flex flex-wrap gap-2">
                              {cfg.priceSuggestions.map(p => (
                                <button key={p} type="button" onClick={() => upd("priceRange", p)}
                                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95
                                    ${bizData.priceRange === p ? "bg-green-500/10 border-green-500 text-green-700" : "bg-background border-border text-muted-foreground hover:border-green-400 hover:text-green-700"}`}>
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                          <input type="text" placeholder={cfg ? `e.g. ${cfg.priceHint}` : "₹200–₹800"} className={inp}
                            value={bizData.priceRange} onChange={e => upd("priceRange", e.target.value)} />
                        </div>

                        {/* ── About + Experience + Certifications ── */}
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold">About Your Business</label>
                          <textarea rows={2} placeholder="Tell customers what makes you special..."
                            className={`${inp} resize-none`}
                            value={bizData.description} onChange={e => upd("description", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-muted-foreground" /> Years Exp.</label>
                            <input type="number" min={0} max={99} placeholder="e.g. 5" className={inp}
                              value={bizData.yearsExperience} onChange={e => upd("yearsExperience", e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-muted-foreground" /> Certifications</label>
                            <input type="text" placeholder="e.g. ISO, Licensed..." className={inp}
                              value={bizData.certifications} onChange={e => upd("certifications", e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={() => { setError(""); setSetupStep(4); }} className={primaryBtn}>
                        Continue <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })()}

                {/* ── Step 4: Go Live ── */}
                {setupStep === 4 && (
                  <div className="space-y-5">
                    <div>
                      <BackButton onClick={() => { setError(""); setSetupStep(3); }} />
                      <h2 className="text-xl font-display font-bold">Almost there!</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Add your online links and choose how to go live.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-muted-foreground" /> Website</label>
                          <input type="url" placeholder="https://..." className={inp}
                            value={bizData.website} onChange={e => upd("website", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5 text-muted-foreground" /> Instagram</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
                            <input type="text" placeholder="handle"
                              className={`${inp} pl-7`}
                              value={bizData.instagram} onChange={e => upd("instagram", e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Directory listing card */}
                      <button type="button" onClick={() => upd("getListedOnDirectory", !bizData.getListedOnDirectory)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                          ${bizData.getListedOnDirectory ? "border-secondary/60 bg-secondary/5 dark:bg-secondary/10" : "border-border bg-background hover:bg-muted/50"}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors
                          ${bizData.getListedOnDirectory ? "bg-secondary text-white" : "bg-muted text-muted-foreground"}`}>
                          <Search className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">Get listed on Google</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {bizData.getListedOnDirectory
                              ? bizData.city ? `Customers in ${bizData.city} will discover you` : "Add your city (step 2) to get listed"
                              : "Appear in Google & Sevu local search"}
                          </p>
                        </div>
                        <div className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0
                          ${bizData.getListedOnDirectory ? "bg-secondary" : "bg-muted"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                            ${bizData.getListedOnDirectory ? "translate-x-6" : ""}`} />
                        </div>
                      </button>
                    </div>

                    <button type="button"
                      disabled={bizSubmitting}
                      onClick={handleBizSubmit as any}
                      className={`${primaryBtn} ${bizData.getListedOnDirectory && bizData.city ? "from-blue-500 to-blue-600 shadow-blue-500/25" : ""}`}>
                      {bizSubmitting
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : bizData.getListedOnDirectory && bizData.city
                          ? <><Search className="w-5 h-5" /> Launch & Get on Google</>
                          : <><CheckCircle2 className="w-5 h-5" /> Finish Setup</>
                      }
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })()}

          {/* ── Success ── */}
          {screen === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center space-y-8">
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-display font-bold">
                  {bizData.getListedOnDirectory && bizData.city ? "You're Live on Sevu! 🎉" : "You're all set! 🎉"}
                </h2>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  {bizData.getListedOnDirectory && bizData.city
                    ? `Your business is listed in ${bizData.city} and will appear in Google search.`
                    : "Your Sevu account is ready. Start adding customers and sending reminders."}
                </p>
              </div>
              <button onClick={() => setLocation("/app/dashboard")}
                className={primaryBtn}>
                Go to Dashboard <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
