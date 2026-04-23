import { useState, useEffect, useRef } from "react";
import {
  Users, Bell, TrendingUp, Globe, Star, MessageCircle,
  ArrowRight, CheckCircle, ChevronDown, Menu, X,
  Wrench, Zap, Scissors, Droplets, Shield, BarChart3,
  MapPin, Phone, Calendar, Award, Sparkles, ChevronRight,
  Twitter, Linkedin, Youtube, Mail,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, inView };
}

function FadeIn({
  children, delay = 0, className = "", direction = "up",
}: {
  children: React.ReactNode; delay?: number; className?: string; direction?: "up" | "left" | "right" | "none";
}) {
  const { ref, inView } = useInView();
  const transforms: Record<string, string> = {
    up: "translateY(32px)", left: "translateX(-24px)", right: "translateX(24px)", none: "none",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translate(0)" : transforms[direction],
        transition: `opacity 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── NAVBAR ─────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Directory", href: "#directory" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Find a Pro", href: "/profile" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-[0_1px_0_rgba(0,0,0,0.06)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between h-[68px]">
        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <img
            src={`${BASE}/images/logo.png`}
            alt="Sevu logo"
            className="w-9 h-9 object-contain group-hover:scale-105 transition-transform duration-300"
          />
          <span className="font-bold text-xl tracking-tight text-slate-900">Sevu</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            l.label === "Find a Pro" ? (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-200 flex items-center gap-1"
              >
                {l.label}
                <ChevronRight size={13} className="opacity-60" />
              </a>
            ) : (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200"
              >
                {l.label}
              </a>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="/app/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
          >
            Sign in
          </a>
          <a
            href="/app/signup"
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm"
          >
            Get Started Free
            <ArrowRight size={14} />
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 px-5 pb-5">
          <div className="pt-3 space-y-1">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-sm font-medium text-slate-700 border-b border-slate-50"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="pt-4 flex flex-col gap-2">
            <a href="/app/login" className="block text-center py-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl">
              Sign in
            </a>
            <a href="/app/signup" className="block text-center py-3 text-sm font-semibold bg-slate-900 text-white rounded-xl">
              Get Started Free
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── HERO ───────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(14,165,233,0.12),transparent)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-100/60 via-cyan-50/40 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-green-100/50 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <FadeIn delay={0}>
            <div className="inline-flex items-center gap-2.5 bg-white border border-slate-200 shadow-sm rounded-full px-4 py-2 mb-8">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs font-semibold text-slate-600">Trusted by 100+ local businesses</span>
            </div>
          </FadeIn>

          <FadeIn delay={60}>
            <h1 className="text-5xl sm:text-6xl lg:text-[4rem] xl:text-[4.5rem] font-extrabold text-slate-900 leading-[1.08] tracking-tight mb-6">
              Never Lose a<br />
              <span className="bg-gradient-to-r from-blue-700 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
                Customer Again
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={120}>
            <p className="text-lg sm:text-xl text-slate-500 leading-relaxed mb-10 max-w-lg">
              Track customers, send WhatsApp reminders, and grow your local business — all from your phone. Built for plumbers, electricians, salons and every service provider in India.
            </p>
          </FadeIn>

          <FadeIn delay={180}>
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <a
                href="/app/signup"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-cyan-600 hover:from-blue-800 hover:to-cyan-700 text-white font-semibold px-7 py-3.5 rounded-xl shadow-lg shadow-blue-200/60 hover:shadow-blue-300/60 transition-all duration-300 hover:-translate-y-0.5 text-[15px]"
              >
                Start Free — No Card Needed
                <ArrowRight size={16} />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 text-[15px] hover:bg-slate-50"
              >
                See How It Works
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={240}>
            <div className="flex flex-wrap gap-5">
              {[
                "Free 7-day trial",
                "No technical skills needed",
                "Setup in under 2 minutes",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-slate-500">
                  <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>

        {/* Right — Dashboard mockup */}
        <FadeIn delay={200} direction="right" className="relative">
          <div className="relative">
            {/* Main card */}
            <div className="bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-slate-100/80 overflow-hidden">
              {/* Title bar */}
              <div className="bg-gradient-to-r from-[#1E3A8A] to-[#0EA5E9] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                  </div>
                  <span className="text-white/70 text-xs font-medium tracking-wide">Sevu Dashboard</span>
                </div>
                <img src={`${BASE}/images/logo.png`} alt="" className="w-6 h-6 object-contain opacity-80" />
              </div>

              <div className="p-5 bg-slate-50/80">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Customers", value: "142", icon: <Users size={14} />, accent: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
                    { label: "This Month", value: "₹18,400", icon: <TrendingUp size={14} />, accent: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                    { label: "Pending", value: "9", icon: <Bell size={14} />, accent: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100" },
                  ].map((s) => (
                    <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-3.5`}>
                      <div className={`${s.accent} mb-1.5`}>{s.icon}</div>
                      <p className="text-[10px] text-slate-400 font-medium mb-0.5">{s.label}</p>
                      <p className={`text-sm font-bold ${s.accent}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Customer list */}
                <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-3">
                  <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Recent Customers</p>
                  {[
                    { name: "Ramesh Kumar", service: "Plumbing Repair", status: "Paid", sc: "text-emerald-600 bg-emerald-50" },
                    { name: "Sunita Devi", service: "Electrical Fix", status: "Reminder Sent", sc: "text-blue-600 bg-blue-50" },
                    { name: "Arjun Singh", service: "AC Service", status: "Pending", sc: "text-amber-500 bg-amber-50" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {c.name[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{c.name}</p>
                          <p className="text-[10px] text-slate-400">{c.service}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-lg ${c.sc}`}>{c.status}</span>
                    </div>
                  ))}
                </div>

                {/* Reminder */}
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs font-bold text-slate-700 mb-2.5 uppercase tracking-wide">Today's Reminder</p>
                  <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-100 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <MessageCircle size={14} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">WhatsApp sent to Ramesh</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">"Your AC service is due this week"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-5 -right-5 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                <Star size={16} className="text-white" fill="white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">4.9 Rating</p>
                <p className="text-[11px] text-slate-400">120 reviews</p>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-600">+₹4,200</p>
                <p className="text-[11px] text-slate-400">earned this week</p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-300 animate-bounce">
        <ChevronDown size={18} />
      </div>
    </section>
  );
}

/* ─── LOGOS / TRUST BAR ───────────────────────────────────── */
function TrustBar() {
  const types = ["Plumbers", "Electricians", "Salons & Spas", "AC Repair", "Carpenters", "Painters", "Mechanics", "Tutors"];
  return (
    <section className="py-10 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6">Trusted by local service providers across India</p>
        <div className="flex flex-wrap justify-center gap-3">
          {types.map((t) => (
            <span key={t} className="bg-slate-50 border border-slate-100 text-slate-500 text-xs font-medium px-4 py-2 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── PROBLEM → SOLUTION ──────────────────────────────────── */
function Problems() {
  const cards = [
    {
      Icon: Users,
      problem: "Customers forget you exist",
      solution: "Automated WhatsApp Reminders",
      desc: "Sevu sends perfectly timed reminders so your customers always come back — without you lifting a finger.",
      gradient: "from-blue-600 to-blue-800",
      lightBg: "bg-blue-50",
      border: "border-blue-100",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      Icon: BarChart3,
      problem: "You can't track your earnings",
      solution: "Smart Income Dashboard",
      desc: "Log every job and see your weekly, monthly and yearly earnings in one clean view. Know exactly where your money comes from.",
      gradient: "from-cyan-500 to-blue-600",
      lightBg: "bg-cyan-50",
      border: "border-cyan-100",
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600",
    },
    {
      Icon: Globe,
      problem: "New customers can't find you",
      solution: "Free Online Business Profile",
      desc: "Your Sevu profile is public and searchable. When someone nearby searches for your service, they find you first.",
      gradient: "from-emerald-500 to-teal-600",
      lightBg: "bg-emerald-50",
      border: "border-emerald-100",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">The Problem</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Running a local business is harder than it should be
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed">
            Most local businesses lose customers not because of bad service — but because there's no system to follow up and stay visible.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((c, i) => (
            <FadeIn key={c.problem} delay={i * 100}>
              <div className={`${c.lightBg} border ${c.border} rounded-3xl p-7 h-full group hover:shadow-lg transition-all duration-300`}>
                <div className={`inline-flex items-center justify-center w-12 h-12 ${c.iconBg} rounded-2xl mb-5`}>
                  <c.Icon size={22} className={c.iconColor} />
                </div>
                <p className="text-sm text-slate-400 line-through mb-2 font-medium">{c.problem}</p>
                <h3 className={`text-lg font-bold mb-3 bg-gradient-to-r ${c.gradient} bg-clip-text text-transparent`}>
                  {c.solution}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">{c.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FEATURES ────────────────────────────────────────────── */
function Features() {
  const features = [
    { Icon: Users, title: "Customer Management", desc: "Store every customer's details, service history, and notes in one organized place.", color: "text-blue-600", bg: "bg-blue-50" },
    { Icon: Bell, title: "Smart Reminders", desc: "Schedule WhatsApp reminders for follow-ups, service renewals, and birthdays automatically.", color: "text-cyan-600", bg: "bg-cyan-50" },
    { Icon: TrendingUp, title: "Earnings Tracking", desc: "Track income per customer and per service type. See your growth month over month.", color: "text-emerald-600", bg: "bg-emerald-50" },
    { Icon: Globe, title: "Online Business Profile", desc: "A public, searchable profile page that helps new customers discover and trust your business.", color: "text-violet-600", bg: "bg-violet-50" },
    { Icon: Star, title: "Review Collection", desc: "Let satisfied customers leave verified ratings that build your reputation on Sevu.", color: "text-amber-600", bg: "bg-amber-50" },
    { Icon: MessageCircle, title: "WhatsApp Integration", desc: "Send service reminders and updates directly through WhatsApp with a single tap.", color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <section id="features" className="py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Everything your business needs
          </h2>
          <p className="text-slate-500 text-lg">Simple, powerful tools designed for local service providers — zero technical skills needed.</p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 70}>
              <div className="bg-white rounded-3xl border border-slate-100 p-7 group hover:border-slate-200 hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-12 h-12 ${f.bg} rounded-2xl mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <f.Icon size={22} className={f.color} />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { Icon: Users, num: "01", title: "Add Your Customer", desc: "Enter the customer's name, phone number, and the service you completed. Takes under 30 seconds.", color: "from-blue-600 to-blue-800" },
    { Icon: Calendar, num: "02", title: "Set a Reminder", desc: "Choose when to follow up — one week, one month, or a custom date. Sevu sends the WhatsApp automatically.", color: "from-cyan-500 to-blue-600" },
    { Icon: TrendingUp, num: "03", title: "Watch Your Business Grow", desc: "Customers return, earnings increase, and new customers find you through your Sevu profile.", color: "from-emerald-500 to-teal-600" },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <FadeIn className="text-center max-w-2xl mx-auto mb-20">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Up and running in 3 steps
          </h2>
          <p className="text-slate-500 text-lg">If you can send a WhatsApp message, you can use Sevu.</p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-[52px] left-[calc(16.67%+40px)] right-[calc(16.67%+40px)] h-px bg-gradient-to-r from-blue-200 via-cyan-200 to-emerald-200" />

          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 120} className="text-center">
              <div className="relative inline-block mb-6">
                <div className={`w-[88px] h-[88px] rounded-3xl bg-gradient-to-br ${s.color} flex items-center justify-center mx-auto shadow-lg`}>
                  <s.Icon size={32} className="text-white" />
                </div>
                <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                  <span className="text-[10px] font-extrabold text-slate-500">{s.num}</span>
                </div>
              </div>
              <h3 className="font-extrabold text-xl text-slate-900 mb-3">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── DIRECTORY ───────────────────────────────────────────── */
function Directory() {
  const profiles = [
    { Icon: Droplets, name: "Rajesh Plumbing Works", category: "Plumber", location: "Laxmi Nagar, Delhi", rating: 4.9, reviews: 87, price: "₹200/visit", color: "from-blue-500 to-cyan-500" },
    { Icon: Zap, name: "Suresh Power Electricals", category: "Electrician", location: "Andheri West, Mumbai", rating: 4.7, reviews: 63, price: "₹300/visit", color: "from-amber-400 to-orange-500" },
    { Icon: Scissors, name: "Priya Beauty Studio", category: "Beauty & Wellness", location: "Koramangala, Bengaluru", rating: 4.8, reviews: 112, price: "₹500/session", color: "from-pink-500 to-rose-500" },
  ];

  return (
    <section id="directory" className="py-24 bg-gradient-to-b from-slate-900 to-blue-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(14,165,233,0.15),transparent)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-cyan-400 uppercase tracking-widest mb-3">Local Directory</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-5">
            Get Found by New Customers
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Thousands of people search daily for plumbers, electricians, and local services. Your Sevu profile puts you right in front of them.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {profiles.map((p, i) => (
            <FadeIn key={p.name} delay={i * 100}>
              <div className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-3xl p-6 hover:bg-white/12 hover:border-white/20 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <p.Icon size={22} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm leading-snug">{p.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{p.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2.5 py-1 flex-shrink-0">
                    <Shield size={10} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400">Verified</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={12} className="text-amber-400 fill-amber-400" />
                  ))}
                  <span className="text-white font-bold text-sm ml-1">{p.rating}</span>
                  <span className="text-slate-400 text-xs">({p.reviews})</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <MapPin size={11} />
                    <span>{p.location}</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-xs">{p.price}</span>
                </div>

                <div className="flex gap-2 mt-4">
                  <button className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/18 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors">
                    <Phone size={12} /> Call
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold py-2.5 rounded-xl transition-colors">
                    <MessageCircle size={12} /> WhatsApp
                  </button>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn className="text-center">
          <a
            href="/profile"
            className="inline-flex items-center gap-2.5 bg-white text-slate-900 font-bold px-7 py-3.5 rounded-2xl hover:bg-slate-50 transition-colors shadow-xl text-sm"
          >
            Browse All Service Providers
            <ChevronRight size={16} />
          </a>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── TESTIMONIALS ────────────────────────────────────────── */
function Testimonials() {
  const reviews = [
    { name: "Raju Sharma", role: "Plumber · Delhi", initials: "RS", text: "Sevu helped me get repeat customers! The WhatsApp reminders go out automatically and my income increased by 30% in just two months.", gradient: "from-blue-500 to-cyan-500" },
    { name: "Meena Patel", role: "Electrician · Ahmedabad", initials: "MP", text: "Before Sevu I had no way to track earnings. Now I see every payment, which customers are pending — it's like having an accountant for free.", gradient: "from-violet-500 to-purple-600" },
    { name: "Vikram Rao", role: "Salon Owner · Bengaluru", initials: "VR", text: "12 new customers found me on Sevu in one month just from my profile page. I never expected online discovery to work this well.", gradient: "from-emerald-500 to-teal-600" },
  ];

  return (
    <section className="py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Testimonials</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Loved by local businesses
          </h2>
          <p className="text-slate-500 text-lg">Real stories from real business owners using Sevu every day.</p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <FadeIn key={r.name} delay={i * 100}>
              <div className="bg-white rounded-3xl border border-slate-100 p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                <div className="flex gap-0.5 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-[15px] leading-relaxed flex-1 mb-6">"{r.text}"</p>
                <div className="flex items-center gap-3 pt-5 border-t border-slate-50">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${r.gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {r.initials}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{r.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.role}</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── STATS ───────────────────────────────────────────────── */
function Stats() {
  const stats = [
    { Icon: Users, value: "100+", label: "Businesses on Sevu" },
    { Icon: Award, value: "1,000+", label: "Customers Managed" },
    { Icon: TrendingUp, value: "₹1 Lakh+", label: "Revenue Tracked" },
    { Icon: Star, value: "4.9 / 5", label: "Average Rating" },
  ];

  return (
    <section className="py-20 bg-gradient-to-r from-[#1E3A8A] via-[#0EA5E9] to-[#22C55E]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 80}>
              <div className="text-white">
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                    <s.Icon size={22} className="text-white" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold mb-1">{s.value}</div>
                <div className="text-white/70 text-sm font-medium">{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── PRICING ─────────────────────────────────────────────── */
function Pricing() {
  const plans = [
    {
      name: "Free Trial",
      price: "₹0",
      period: "7 days",
      desc: "Full access, no card needed. Experience everything Sevu has to offer.",
      features: ["Up to 20 customers", "WhatsApp reminders", "Basic earnings view", "Public profile page"],
      cta: "Start Free Trial",
      href: "/app/signup",
      popular: false,
    },
    {
      name: "Basic",
      price: "₹59",
      period: "per month",
      desc: "Everything a solo service provider needs to retain customers and grow.",
      features: ["Unlimited customers", "Automated reminders", "Full earnings tracking", "Sevu directory listing", "Customer reviews & ratings"],
      cta: "Get Basic",
      href: "/app/signup",
      popular: true,
    },
    {
      name: "Pro",
      price: "₹99",
      period: "per month",
      desc: "Advanced tools for growing businesses ready to scale.",
      features: ["Everything in Basic", "Advanced analytics", "Priority directory listing", "Custom profile URL", "Priority support"],
      cta: "Get Pro",
      href: "/app/signup",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-500 text-lg">Start free for 7 days. No credit card required. Cancel anytime.</p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((p, i) => (
            <FadeIn key={p.name} delay={i * 80}>
              <div className={`rounded-3xl p-7 relative transition-all ${
                p.popular
                  ? "bg-gradient-to-b from-[#1E3A8A] to-[#1e40af] text-white shadow-2xl shadow-blue-300/30 ring-1 ring-blue-800 md:scale-105"
                  : "bg-white border border-slate-100 shadow-sm hover:shadow-md"
              }`}>
                {p.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-900 text-xs font-extrabold px-4 py-1.5 rounded-full shadow-lg">
                      <Sparkles size={11} />
                      Most Popular
                    </div>
                  </div>
                )}

                <p className={`font-extrabold text-lg mb-1 ${p.popular ? "text-white" : "text-slate-900"}`}>{p.name}</p>
                <p className={`text-sm mb-5 leading-relaxed ${p.popular ? "text-blue-200" : "text-slate-400"}`}>{p.desc}</p>

                <div className="mb-6 flex items-end gap-2">
                  <span className={`text-5xl font-extrabold tracking-tight ${p.popular ? "text-white" : "text-slate-900"}`}>{p.price}</span>
                  <span className={`text-sm mb-2 ${p.popular ? "text-blue-200" : "text-slate-400"}`}>/{p.period}</span>
                </div>

                <ul className="space-y-3 mb-7">
                  {p.features.map((f) => (
                    <li key={f} className={`text-sm flex items-start gap-2.5 ${p.popular ? "text-blue-100" : "text-slate-600"}`}>
                      <CheckCircle size={15} className={`flex-shrink-0 mt-0.5 ${p.popular ? "text-cyan-300" : "text-emerald-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={p.href}
                  className={`flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all text-[15px] ${
                    p.popular
                      ? "bg-white text-blue-800 hover:bg-blue-50"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {p.cta}
                  <ArrowRight size={15} />
                </a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────── */
function FAQ() {
  const faqs = [
    { q: "What is Sevu?", a: "Sevu is a customer management and discovery platform built for local service providers in India. It helps plumbers, electricians, salons, and similar businesses track customers, send automated WhatsApp reminders, and attract new clients through a free online profile." },
    { q: "How does Sevu help my business?", a: "Sevu sends automatic WhatsApp reminders that bring customers back, tracks your earnings with clear dashboards, and gives you a public profile so new customers can find, trust, and contact you — all from your phone." },
    { q: "Is Sevu free to use?", a: "Yes. Sevu offers a free 7-day trial with full access to all features. After that, paid plans start at just ₹59/month. No credit card is required to start your trial." },
    { q: "Do I need any technical knowledge?", a: "None at all. Sevu is designed specifically for local business owners. If you can use WhatsApp, you can use Sevu. Setup takes under two minutes." },
    { q: "How do I get new customers through Sevu?", a: "When you create your business profile on Sevu, it becomes publicly searchable. Customers in your city looking for your type of service can find your profile, view your ratings, and contact you directly." },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <FadeIn className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Frequently asked questions
          </h2>
          <p className="text-slate-500 text-lg">Everything you need to know about Sevu.</p>
        </FadeIn>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <FadeIn key={i} delay={i * 50}>
              <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${open === i ? "border-blue-100 shadow-sm" : "border-slate-100"}`}>
                <button
                  className="w-full flex items-center justify-between p-6 text-left"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span className="font-semibold text-slate-800 pr-6 text-[15px]">{f.q}</span>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${open === i ? "bg-blue-600 text-white rotate-180" : "bg-slate-100 text-slate-500"}`}>
                    <ChevronDown size={16} />
                  </div>
                </button>
                {open === i && (
                  <div className="px-6 pb-6">
                    <p className="text-slate-500 text-sm leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FINAL CTA ───────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-5 sm:px-8">
        <FadeIn>
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1E3A8A] via-[#1d4ed8] to-[#0EA5E9] p-12 sm:p-16 text-center shadow-2xl shadow-blue-200">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,rgba(34,197,94,0.2),transparent)] pointer-events-none" />

            <div className="relative">
              <div className="flex justify-center mb-6">
                <img src={`${BASE}/images/logo.png`} alt="Sevu" className="w-16 h-16 object-contain drop-shadow-xl" />
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5 leading-tight">
                Start growing your<br />business today
              </h2>
              <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                Join 100+ local businesses already using Sevu to manage customers, send reminders, and earn more — every month.
              </p>
              <a
                href="/app/signup"
                className="inline-flex items-center gap-3 bg-white text-blue-800 font-extrabold px-8 py-4 rounded-2xl text-base hover:bg-blue-50 transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                Start Free Now — No Card Needed
                <ArrowRight size={18} />
              </a>
              <p className="text-blue-300/80 text-sm mt-5">7-day free trial · Full access · Cancel anytime</p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── FOOTER ──────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={`${BASE}/images/logo.png`} alt="Sevu" className="w-9 h-9 object-contain" />
              <span className="font-bold text-xl text-white tracking-tight">Sevu</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 mb-5">
              Customer management and discovery platform for local service providers across India.
            </p>
            <div className="flex gap-3">
              {[
                { Icon: Twitter, label: "Twitter" },
                { Icon: Linkedin, label: "LinkedIn" },
                { Icon: Youtube, label: "YouTube" },
                { Icon: Mail, label: "Email" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {[
            {
              heading: "Product",
              links: ["Features", "Pricing", "Directory", "How It Works"],
            },
            {
              heading: "Company",
              links: ["About", "Blog", "Careers", "Contact"],
            },
            {
              heading: "Legal",
              links: ["Privacy Policy", "Terms of Service", "Refund Policy", "Support"],
            },
          ].map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">{col.heading}</p>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Sevu. All rights reserved.</p>
          <p className="text-xs text-slate-600">Made with care for local businesses across India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}

/* ─── PAGE ────────────────────────────────────────────────── */
export default function Homepage() {
  useEffect(() => {
    document.title = "Sevu – Grow Your Local Business | Customer Management & Reminders";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "Sevu helps plumbers, electricians, and local businesses track customers, send WhatsApp reminders, and get more work. Start free today — no card needed.";
  }, []);

  return (
    <div className="font-sans antialiased text-slate-900 bg-white">
      <Navbar />
      <Hero />
      <TrustBar />
      <Problems />
      <Features />
      <HowItWorks />
      <Directory />
      <Testimonials />
      <Stats />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
