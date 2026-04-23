import { useState } from "react";
import { useLocation } from "wouter";
import { UserCircle2, Phone, ArrowRight, FlaskConical, Star, ChevronLeft } from "lucide-react";

function saveReviewer(data: { name: string; phone?: string }) {
  localStorage.setItem("sevuReviewer", JSON.stringify(data));
}

export default function ReviewerLogin() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name"); return; }
    saveReviewer({ name: name.trim(), phone: phone.trim() });
    setLocation("/profile");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-8">

        {/* Back */}
        <button onClick={() => setLocation("/profile")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to directory
        </button>

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Star className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold">Leave a Review</h1>
          <p className="text-muted-foreground text-sm">Sign in to share your experience with local businesses</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Your Name</label>
            <div className="relative">
              <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Phone Number <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted/40 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button type="submit"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition active:scale-[0.98]">
            Continue to Reviews
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">Are you a business owner?</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button onClick={() => setLocation("/app/login")}
          className="w-full py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition">
          Business Login →
        </button>
      </div>
    </div>
  );
}
