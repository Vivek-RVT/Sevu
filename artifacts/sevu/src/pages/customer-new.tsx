import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateCustomer, useListCustomers, type Customer } from "@workspace/api-client-react";
import { useBusinessId } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import { DatePicker } from "@/components/date-picker";
import {
  ArrowLeft, Loader2, UserPlus, ChevronDown,
  StickyNote, MapPin, User, Users, Bell, Sparkles,
  Mail, Wrench, CalendarDays, Phone,
} from "lucide-react";

const inp = "w-full px-4 py-3.5 bg-card border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium placeholder:text-muted-foreground/50 text-base";

// ── Country codes — with exact digit limits and example placeholders ─────────
const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India",        digits: 10, placeholder: "98765 43210" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan",     digits: 10, placeholder: "300 1234567" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh",   digits: 10, placeholder: "1712 345678" },
  { code: "+977", flag: "🇳🇵", name: "Nepal",        digits: 10, placeholder: "980 1234567" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka",    digits: 9,  placeholder: "71 234 5678" },
  { code: "+971", flag: "🇦🇪", name: "UAE",          digits: 9,  placeholder: "50 123 4567" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia", digits: 9,  placeholder: "50 123 4567" },
  { code: "+974", flag: "🇶🇦", name: "Qatar",        digits: 8,  placeholder: "3312 3456"  },
  { code: "+965", flag: "🇰🇼", name: "Kuwait",       digits: 8,  placeholder: "6512 3456"  },
  { code: "+1",   flag: "🇺🇸", name: "USA/Canada",   digits: 10, placeholder: "212 555 0100"},
  { code: "+44",  flag: "🇬🇧", name: "UK",           digits: 10, placeholder: "7911 123456" },
  { code: "+61",  flag: "🇦🇺", name: "Australia",    digits: 9,  placeholder: "412 345 678" },
  { code: "+49",  flag: "🇩🇪", name: "Germany",      digits: 11, placeholder: "151 23456789"},
  { code: "+65",  flag: "🇸🇬", name: "Singapore",    digits: 8,  placeholder: "8123 4567"  },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia",     digits: 9,  placeholder: "12 345 6789" },
];

export default function CustomerNew() {
  const { businessId } = useBusinessId();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createCustomer = useCreateCustomer();

  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [birthday, setBirthday] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState("");

  if (!businessId) return <Redirect to="/app/login" />;

  const { data: customers } = useListCustomers({ businessId });
  const autoName = `Customer ${(customers?.length ?? 0) + 1}`;

  const fullPhone = `${selectedCountry.code}${phoneNumber}`;
  const phoneComplete = phoneNumber.length === selectedCountry.digits;
  const canSubmit = name.trim().length > 0 && phoneNumber.length >= 6;

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = COUNTRY_CODES.find(c => c.code === e.target.value);
    if (found) {
      setSelectedCountry(found);
      setPhoneNumber(""); // reset number when country changes
    }
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    // Hard cap at max digits for this country
    setPhoneNumber(digits.slice(0, selectedCountry.digits));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 6) { setError("Enter a valid phone number."); return; }
    setError("");
    haptic("medium");

    const tempId = -Date.now();
    const optimistic: Customer = {
      id: tempId,
      businessId,
      name: name.trim(),
      phone: fullPhone.trim(),
      email: email.trim() || undefined,
      gender: gender || undefined,
      address: address.trim() || undefined,
      birthday: birthday || undefined,
      serviceType: serviceType.trim() || undefined,
      nextServiceDate: nextServiceDate || undefined,
      notes: notes.trim() || undefined,
      totalSpent: 0,
      outstandingBalance: 0,
      tags: null as any,
      createdAt: new Date().toISOString(),
    } as any;

    // Cancel any in-flight customer fetches so they can't overwrite the
    // optimistic entry, then inject it into every /api/customers cache slot.
    await queryClient.cancelQueries({ queryKey: ["/api/customers"] });
    queryClient.setQueriesData<Customer[]>(
      { queryKey: ["/api/customers"] },
      old => [optimistic, ...(old ?? [])],
    );

    haptic("success");

    const payload = {
      businessId,
      name: name.trim(),
      phone: fullPhone.trim(),
      email: email.trim() || undefined,
      gender: gender || undefined,
      address: address.trim() || undefined,
      birthday: birthday || undefined,
      serviceType: serviceType.trim() || undefined,
      nextServiceDate: nextServiceDate || undefined,
      notes: notes.trim() || undefined,
    };

    // Fire the POST request FIRST so it's already in flight by the time
    // the customers list mounts and tries to refetch. This prevents the
    // race where a mount-time refetch returns the old list (without the
    // new customer) and wipes out our optimistic entry.
    createCustomer.mutate(
      { data: payload },
      {
        onSuccess: (real) => {
          // Replace the temp entry in every customers cache slot with the real one.
          // If a racing refetch wiped the cache, ensure the new customer is still added.
          queryClient.setQueriesData<Customer[]>(
            { queryKey: ["/api/customers"] },
            old => {
              const list = old ?? [];
              const hasTemp = list.some(c => c.id === tempId);
              if (hasTemp) {
                return list.map(c => c.id === tempId ? (real as Customer) : c);
              }
              if (list.some(c => c.phone === (real as Customer).phone)) return list;
              return [real as Customer, ...list];
            },
          );
          // Force a fresh fetch on the customers list (which the user just
          // navigated to) AND on the dashboard so their data is consistent
          // with the server. This cancels any stale in-flight requests.
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["customers-dash"] });
        },
        onError: () => {
          queryClient.setQueriesData<Customer[]>(
            { queryKey: ["/api/customers"] },
            old => (old ?? []).filter(c => c.id !== tempId),
          );
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
        },
      }
    );

    // Now navigate — the form unmounts immediately, the customers list
    // page mounts and shows the optimistic entry from the cache (which
    // is fresh because we just set it), and the in-flight POST will
    // resolve and replace the temp entry with the real one.
    setLocation("/app/customers");
  };

  return (
    <div className="h-screen bg-background flex flex-col max-w-md mx-auto">

      {/* Header */}
      <div className="bg-background/95 backdrop-blur-xl px-4 py-3 border-b border-border/50 flex items-center gap-3 flex-shrink-0 z-10">
        <button onClick={() => setLocation("/app/customers")}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors active:scale-90">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-sm">
            <UserPlus className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-display font-bold leading-tight">New Customer</h1>
            <p className="text-[11px] text-muted-foreground font-light leading-none">Just name + phone needed</p>
          </div>
        </div>
      </div>

      {/* Form wraps both scroll area + sticky button */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-5 pb-4 space-y-4">

          {/* ── Phone with country code ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Phone Number <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2 items-stretch">

              {/* Country selector */}
              <div className="relative flex-shrink-0">
                <select
                  value={selectedCountry.code}
                  onChange={handleCountryChange}
                  className="appearance-none h-full pl-2.5 pr-7 py-3.5 bg-card border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none font-semibold text-sm cursor-pointer"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>

              {/* Number — digits only, hard-capped, no autocomplete */}
              <div className="relative flex-1">
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  required
                  placeholder={selectedCountry.placeholder}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name={`phone_${selectedCountry.code}_${Math.random()}`}
                  maxLength={selectedCountry.digits}
                  className={`${inp} flex-1 pr-14`}
                  value={phoneNumber}
                  onChange={handlePhoneInput}
                />
                {/* Digit counter */}
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold tabular-nums pointer-events-none ${phoneComplete ? "text-green-500" : "text-muted-foreground/60"}`}>
                  {phoneNumber.length}/{selectedCountry.digits}
                </span>
              </div>
            </div>

            {/* Preview of full number */}
            {phoneNumber.length > 0 && (
              <p className="text-xs text-muted-foreground pl-1 flex items-center gap-1">
                Saved as:
                <span className="font-semibold text-foreground tracking-wide">{fullPhone}</span>
                {phoneComplete && <span className="text-green-500 font-bold">✓</span>}
              </p>
            )}
          </div>

          {/* ── Customer Name ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-foreground">
              Customer Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              name="customer_name_field"
              className={inp}
              value={name}
              onChange={e => setName(e.target.value)}
            />
            {phoneNumber.length >= 6 && !name && (
              <button type="button" onClick={() => { haptic("light"); setName(autoName); }}
                className="flex items-center gap-2 text-sm text-primary font-semibold bg-primary/8 hover:bg-primary/15 px-3 py-2 rounded-xl transition-colors w-full active:scale-[0.98]">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                Use: <span className="font-bold">"{autoName}"</span>
                <span className="ml-auto text-xs text-muted-foreground font-light">tap to use</span>
              </button>
            )}
          </div>

          {/* ── More details — collapsible ── */}
          <div className="border border-border/60 rounded-2xl overflow-hidden">
            <button type="button" onClick={() => { haptic("light"); setShowMore(v => !v); }}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} />
                More details
                <span className="font-light text-muted-foreground/70">(optional)</span>
              </span>
              {showMore && <span className="text-[11px] font-normal text-muted-foreground/50">scroll down to fill</span>}
            </button>

            {showMore && (
              <div className="px-4 pb-5 space-y-4 border-t border-border/50">

                {/* Gender */}
                <div className="space-y-1.5 pt-4">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Gender</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "Male",   icon: <User className="w-3.5 h-3.5" /> },
                      { value: "Female", icon: <User className="w-3.5 h-3.5" /> },
                      { value: "Other",  icon: <Users className="w-3.5 h-3.5" /> },
                    ].map(g => (
                      <button key={g.value} type="button"
                        onClick={() => { haptic("light"); setGender(gender === g.value ? "" : g.value); }}
                        className={`py-2.5 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-1.5 transition-all active:scale-95
                          ${gender === g.value ? "bg-primary text-white border-primary shadow-sm" : "bg-background text-foreground border-border hover:border-primary/40"}`}>
                        {g.icon} {g.value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <input type="email" placeholder="e.g. rahul@gmail.com"
                    autoComplete="new-password" name="cust_email_field"
                    className={inp} value={email}
                    onChange={e => setEmail(e.target.value)} />
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Address
                  </label>
                  <input type="text" placeholder="e.g. 12 Gandhi Road, Mumbai"
                    autoComplete="new-password" name="cust_address_field"
                    className={inp} value={address}
                    onChange={e => setAddress(e.target.value)} />
                </div>

                {/* Birthday */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Birthday
                  </label>
                  <DatePicker value={birthday} onChange={setBirthday} placeholder="Choose birthday" disableFuture />
                </div>

                {/* Service Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Service Type
                  </label>
                  <input type="text" placeholder="e.g. Haircut, AC Repair, Massage"
                    autoComplete="new-password" name="cust_service_field"
                    className={inp} value={serviceType}
                    onChange={e => setServiceType(e.target.value)} />
                </div>

                {/* Next Reminder Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Bell className="w-3 h-3" /> Next Reminder Date
                  </label>
                  <DatePicker value={nextServiceDate} onChange={setNextServiceDate} placeholder="Pick reminder date" disablePast />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <StickyNote className="w-3 h-3" /> Note
                  </label>
                  <textarea rows={3} placeholder="Preferences, allergies, special notes..."
                    autoComplete="off" name="cust_notes_field"
                    className={`${inp} resize-none`} value={notes}
                    onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center font-semibold bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
              {error}
            </p>
          )}

        </div>
      </div>

      {/* ── Save button — always visible, stuck to bottom ── */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border/50 bg-background/95 backdrop-blur-xl">
        <button
          type="submit"
          disabled={createCustomer.isPending || !canSubmit}
          className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold text-base shadow-lg shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all flex items-center justify-center gap-2"
        >
          {createCustomer.isPending
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <><Bell className="w-5 h-5" /> Save &amp; Set Reminder</>
          }
        </button>
      </div>

      </form>
    </div>
  );
}
