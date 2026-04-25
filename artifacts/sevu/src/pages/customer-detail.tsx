import { useState, useEffect } from "react";
import { useLocation, useParams, Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { useBusinessId } from "@/lib/store";
import {
  ArrowLeft, Loader2, Save, Trash2, AlertCircle,
  Phone, Wrench, IndianRupee, StickyNote, Bell, Plus,
  MessageCircle, CheckCircle2, Clock, UserPlus, Hammer,
  CalendarDays, SplitSquareHorizontal, ChevronDown,
  Info, Mail, MapPin, Cake, Tag, Hash, ChevronUp, User,
} from "lucide-react";
import { getWhatsAppLink } from "@/lib/whatsapp";
import { format, isBefore, differenceInDays } from "date-fns";
import { CustomerDetailSkeleton } from "@/components/skeletons";

interface ServiceLog {
  id: number;
  customerName: string;
  service: string;
  amount?: number;
  paidAmount?: number;
  paymentStatus: string;
  serviceDate: string;
  nextVisit?: string;
  note?: string;
}

const COMMON_TAGS = ["VIP", "Regular", "New", "Walk-in", "Online"];
const inp = "w-full px-4 py-3.5 bg-background border-2 border-border rounded-xl focus:border-primary outline-none transition-all font-medium text-base";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const customerId = parseInt(id, 10);
  const { businessId } = useBusinessId();
  const [, setLocation] = useLocation();

  if (!customerId || customerId < 0 || isNaN(customerId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useGetCustomer(
    customerId,
    { query: { staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true } },
  );
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const invalidateAfterCustomerChange = () => {
    queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(customerId), refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/customers"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["customers-dash"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["service-logs-dash"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["service-logs-customer"], refetchType: "all" });
  };

  const { data: serviceLogs = [] } = useQuery<ServiceLog[]>({
    queryKey: ["service-logs-customer", customerId, businessId],
    enabled: !!businessId && !!customerId && !isNaN(customerId) && customerId > 0,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch(`/api/service-logs?businessId=${businessId}&customerId=${customerId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  const [formData, setFormData] = useState({
    name: "", phone: "", email: "", address: "", birthday: "",
    serviceType: "", lastServiceDate: "", nextServiceDate: "",
    outstandingBalance: "", totalSpent: "", notes: "", tags: [] as string[],
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        address: customer.address || "",
        birthday: customer.birthday ? customer.birthday.split("T")[0] : "",
        serviceType: customer.serviceType || "",
        lastServiceDate: customer.lastServiceDate ? customer.lastServiceDate.split("T")[0] : "",
        nextServiceDate: customer.nextServiceDate ? customer.nextServiceDate.split("T")[0] : "",
        outstandingBalance: customer.outstandingBalance ? customer.outstandingBalance.toString() : "",
        totalSpent: customer.totalSpent ? customer.totalSpent.toString() : "",
        notes: customer.notes || "",
        tags: customer.tags ? customer.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      });
    }
  }, [customer]);

  if (!businessId) return <Redirect to="/app/login" />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
        <CustomerDetailSkeleton />
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p>Customer not found</p>
        <button onClick={() => setLocation("/app/customers")} className="mt-4 text-primary font-bold">
          Go back
        </button>
      </div>
    );
  }

  const set = (key: string, value: string) => setFormData(f => ({ ...f, [key]: value }));
  const toggleTag = (tag: string) =>
    setFormData(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCustomer.mutateAsync({
        id: customerId,
        data: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          address: formData.address || undefined,
          birthday: formData.birthday || undefined,
          serviceType: formData.serviceType || undefined,
          lastServiceDate: formData.lastServiceDate || undefined,
          nextServiceDate: formData.nextServiceDate || undefined,
          outstandingBalance: formData.outstandingBalance ? parseFloat(formData.outstandingBalance) : undefined,
          totalSpent: formData.totalSpent ? parseFloat(formData.totalSpent) : undefined,
          notes: formData.notes || undefined,
          tags: formData.tags.length > 0 ? formData.tags.join(", ") : undefined,
        },
      });
      invalidateAfterCustomerChange();
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync({ id: customerId });
      invalidateAfterCustomerChange();
      setLocation("/app/customers");
    } catch (err) {
      console.error(err);
    }
  };

  // Derived values
  const tagList = customer.tags ? customer.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  const totalEarned = customer.totalSpent || 0;
  const balanceDue = customer.outstandingBalance || 0;

  // Reminder: prefer customer.nextServiceDate, fall back to upcoming nextVisit from any service log
  const logNextVisit = serviceLogs
    .filter(l => l.nextVisit)
    .map(l => l.nextVisit!)
    .sort()
    .find(d => !isBefore(new Date(d), new Date()));
  const reminderDate = customer.nextServiceDate || logNextVisit || null;
  const isOverdue = reminderDate && isBefore(new Date(reminderDate), new Date());
  const daysUntil = reminderDate ? differenceInDays(new Date(reminderDate), new Date()) : null;

  const avatarColors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-500",
  ];
  const avatarColor = avatarColors[customer.name.charCodeAt(0) % avatarColors.length];

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-xl z-20 px-4 py-3.5 border-b border-border/50 flex items-center justify-between">
        <button onClick={() => setLocation("/app/customers")}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors active:scale-90">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold truncate flex-1 mx-3">
          {isEditing ? "Edit Customer" : customer.name}
        </h1>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)}
            className="text-primary font-bold text-sm bg-primary/10 px-4 py-2 rounded-xl active:scale-95 transition-all">
            Edit
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto pb-10">

        {/* ── EDIT MODE ──────────────────────────────────────────── */}
        {isEditing ? (
          <form onSubmit={handleUpdate} className="p-4 space-y-4">

            <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm space-y-4">
              <h3 className="font-bold text-base">Basic Info</h3>
              {[
                { label: "Full Name *", key: "name", type: "text", required: true },
                { label: "Phone Number *", key: "phone", type: "tel", required: true },
                { label: "Email", key: "email", type: "email", required: false },
                { label: "Address", key: "address", type: "text", required: false },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-sm font-semibold ml-1">{f.label}</label>
                  <input type={f.type} required={f.required} className={inp}
                    value={(formData as any)[f.key]}
                    onChange={e => set(f.key, e.target.value)} />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold ml-1">Birthday</label>
                <input type="date" className={inp} value={formData.birthday} onChange={e => set("birthday", e.target.value)} />
              </div>
            </div>

            <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-secondary" /> Service
              </h3>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold ml-1">Service Type</label>
                <input type="text" className={inp} placeholder="e.g. AC Repair, Haircut"
                  value={formData.serviceType} onChange={e => set("serviceType", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Last Visit", key: "lastServiceDate" },
                  { label: "Next Reminder", key: "nextServiceDate" },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-sm font-semibold ml-1">{f.label}</label>
                    <input type="date" className={inp} value={(formData as any)[f.key]} onChange={e => set(f.key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-500" /> Money
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Earned (₹)", key: "totalSpent" },
                  { label: "Balance Due (₹)", key: "outstandingBalance" },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-sm font-semibold ml-1">{f.label}</label>
                    <input type="number" min={0} className={inp} placeholder="0"
                      value={(formData as any)[f.key]} onChange={e => set(f.key, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold ml-1">Notes</label>
                <textarea rows={3} placeholder="Preferences, allergies, special notes..."
                  className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none resize-none text-sm font-medium"
                  value={formData.notes} onChange={e => set("notes", e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold ml-1">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_TAGS.map(tag => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all active:scale-95 ${formData.tags.includes(tag) ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground border-border"}`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditing(false)}
                className="flex-1 py-4 bg-muted text-foreground rounded-2xl font-bold">
                Cancel
              </button>
              <button type="submit" disabled={updateCustomer.isPending}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                {updateCustomer.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save</>}
              </button>
            </div>

            <div>
              {!showDeleteConfirm ? (
                <button type="button" onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-4 text-destructive bg-destructive/10 rounded-2xl font-bold flex items-center justify-center gap-2 border border-destructive/20">
                  <Trash2 className="w-5 h-5" /> Delete Customer
                </button>
              ) : (
                <div className="bg-destructive/10 p-5 rounded-2xl border border-destructive/30 space-y-4">
                  <p className="text-destructive font-bold text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Pakka delete karna hai?
                  </p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3 bg-background rounded-xl font-bold">Cancel</button>
                    <button type="button" onClick={handleDelete} disabled={deleteCustomer.isPending}
                      className="flex-1 py-3 bg-destructive text-white rounded-xl font-bold flex justify-center">
                      {deleteCustomer.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Haan, Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>

        ) : (
          /* ── VIEW MODE ────────────────────────────────────────── */
          <div className="p-4 space-y-3 pb-10">

            {/* ①  CUSTOMER INFO ─────────────────────────────────── */}
            <div className="bg-card rounded-3xl border border-border/50 shadow-sm px-5 pt-5 pb-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 bg-gradient-to-br ${avatarColor} rounded-2xl flex items-center justify-center text-white text-2xl font-display font-bold shadow-md flex-shrink-0`}>
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-display font-bold leading-tight truncate">{customer.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {customer.phone}
                  </p>
                  {tagList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tagList.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => window.open(getWhatsAppLink(customer.phone, `Hi ${customer.name}, `), "_blank")}
                className="mt-4 w-full bg-[#25D366] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2.5 active:scale-95 transition-all shadow-md shadow-[#25D366]/25 text-[15px]">
                <MessageCircle className="w-5 h-5" /> WhatsApp pe Message Karo
              </button>

              {/* More Info toggle */}
              <button
                onClick={() => setShowMoreInfo(v => !v)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-primary bg-primary/8 hover:bg-primary/12 active:scale-[0.98] transition">
                <Info className="w-4 h-4" />
                {showMoreInfo ? "Hide details" : "More Info"}
                {showMoreInfo
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* ①.5  MORE INFO — expandable details ────────────── */}
            {showMoreInfo && (() => {
              const c = customer as any;
              const empty = <span className="italic text-muted-foreground/50 font-normal">— Not added —</span>;
              const fmtDate = (d: string) => format(new Date(d), "d MMM yyyy");
              type Row = { icon: any; label: string; value: React.ReactNode; filled: boolean };
              const rows: Row[] = [
                { icon: Phone,        label: "Phone",         filled: !!c.phone,           value: c.phone || empty },
                { icon: Mail,         label: "Email",         filled: !!c.email,           value: c.email || empty },
                { icon: MapPin,       label: "Address",       filled: !!c.address,         value: c.address || empty },
                { icon: Cake,         label: "Birthday",      filled: !!c.birthday,        value: c.birthday ? fmtDate(c.birthday) : empty },
                { icon: User,         label: "Gender",        filled: !!c.gender,          value: c.gender || empty },
                { icon: Wrench,       label: "Service type",  filled: !!c.serviceType,     value: c.serviceType || empty },
                { icon: CalendarDays, label: "Last service",  filled: !!c.lastServiceDate, value: c.lastServiceDate ? fmtDate(c.lastServiceDate) : empty },
                { icon: CalendarDays, label: "Next service",  filled: !!c.nextServiceDate, value: c.nextServiceDate ? fmtDate(c.nextServiceDate) : empty },
              ];

              return (
                <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Money summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3 border border-green-100 dark:border-green-900/30">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">Total Earned</p>
                      <p className="text-xl font-display font-bold text-green-600 dark:text-green-400 mt-0.5 flex items-center">
                        <IndianRupee className="w-4 h-4" />{totalEarned.toLocaleString()}
                      </p>
                    </div>
                    <div className={`rounded-2xl p-3 border ${
                      balanceDue > 0
                        ? "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30"
                        : "bg-muted/40 border-border/40"
                    }`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${
                        balanceDue > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                      }`}>Balance Due</p>
                      <p className={`text-xl font-display font-bold mt-0.5 flex items-center ${
                        balanceDue > 0 ? "text-orange-500" : "text-muted-foreground"
                      }`}>
                        <IndianRupee className="w-4 h-4" />{balanceDue.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Tags — always shown, empty sign if none */}
                  <div className={`rounded-2xl px-3 py-2.5 flex items-start gap-2.5 ${tagList.length > 0 ? "bg-muted/40" : "bg-muted/20 border border-dashed border-border/60"}`}>
                    <Tag className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tagList.length > 0 ? "text-muted-foreground" : "text-muted-foreground/50"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Tags</p>
                      {tagList.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tagList.map(t => (
                            <span key={t} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm italic text-muted-foreground/50 font-normal">— Not added —</p>
                      )}
                    </div>
                  </div>

                  {/* Detail rows — every field always shown, empty sign when blank */}
                  {rows.map((r, i) => (
                    <div key={i} className={`rounded-2xl px-3 py-2.5 flex items-start gap-2.5 ${r.filled ? "bg-muted/30" : "bg-muted/15 border border-dashed border-border/60"}`}>
                      <r.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${r.filled ? "text-muted-foreground" : "text-muted-foreground/50"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{r.label}</p>
                        <p className={`text-sm break-words ${r.filled ? "font-semibold text-foreground" : ""}`}>{r.value}</p>
                      </div>
                    </div>
                  ))}

                  {/* Notes — always shown, empty sign if blank */}
                  <div className={`rounded-2xl px-3 py-2.5 flex items-start gap-2.5 ${c.notes ? "bg-muted/30" : "bg-muted/15 border border-dashed border-border/60"}`}>
                    <StickyNote className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.notes ? "text-muted-foreground" : "text-muted-foreground/50"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Notes</p>
                      {c.notes ? (
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words font-semibold">{c.notes}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground/50 font-normal">— Not added —</p>
                      )}
                    </div>
                  </div>

                  {/* Quick "fill missing details" CTA */}
                  {(() => {
                    const missingCount =
                      rows.filter(r => !r.filled).length
                      + (tagList.length === 0 ? 1 : 0)
                      + (c.notes ? 0 : 1);
                    if (missingCount === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => { setShowMoreInfo(false); setIsEditing(true); }}
                        className="w-full mt-1 py-2.5 rounded-xl text-xs font-bold text-primary bg-primary/8 hover:bg-primary/12 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {missingCount} detail{missingCount > 1 ? "s" : ""} missing — tap to add
                      </button>
                    );
                  })()}

                  {/* Meta */}
                  <div className="bg-muted/20 rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
                    <Hash className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium">Customer ID</span>
                      <span className="text-[11px] text-muted-foreground font-mono">#{c.id}</span>
                    </div>
                  </div>
                  {c.createdAt && (
                    <p className="text-[11px] text-center text-muted-foreground/70 pt-1">
                      Added {format(new Date(c.createdAt), "d MMM yyyy")}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ②  ACTIONS ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLocation("/app/services")}
                className="bg-gradient-to-br from-secondary to-secondary/80 text-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-lg shadow-secondary/20 active:scale-95 transition-all">
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold leading-tight text-center">Kaam Add Karo</span>
              </button>
              <button
                onClick={() => setLocation("/app/services")}
                className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all">
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bell className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold leading-tight text-center">Reminder Set Karo</span>
              </button>
            </div>

            {/* ③  NEXT REMINDER ─────────────────────────────────── */}
            {reminderDate ? (
              <div className={`rounded-2xl px-4 py-4 flex items-center gap-3.5 border ${
                isOverdue
                  ? "bg-red-50 dark:bg-red-900/15 border-red-200/60"
                  : "bg-primary/5 border-primary/20"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isOverdue ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/15"
                }`}>
                  <Bell className={`w-5 h-5 ${isOverdue ? "text-red-500" : "text-primary"}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-black uppercase tracking-wider ${isOverdue ? "text-red-500" : "text-primary"}`}>
                    {isOverdue ? "⚠️ Follow-up Miss Ho Gaya!" : "🔔 Next Reminder"}
                  </p>
                  <p className="font-bold text-foreground text-base mt-0.5">
                    {format(new Date(reminderDate), "d MMMM yyyy")}
                  </p>
                  <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                    {isOverdue && daysUntil !== null
                      ? `${Math.abs(daysUntil)} din pehle tha`
                      : daysUntil === 0 ? "Aaj hai!"
                      : `${daysUntil} din baad`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl px-4 py-4 flex items-center gap-3.5 border border-dashed border-border bg-muted/40">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground">Koi reminder nahi set hai</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Upar "Reminder Set Karo" dabao</p>
                </div>
              </div>
            )}

            {/* ④  ACTIVITY TIMELINE ───────────────────────────────── */}
            {(() => {
              type Event = {
                id: string;
                date: Date;
                kind: "created" | "service" | "upcoming";
                log?: ServiceLog;
              };

              const events: Event[] = [];

              // Customer creation event
              if (customer.createdAt) {
                events.push({
                  id: "created",
                  date: new Date(customer.createdAt),
                  kind: "created",
                });
              }

              // Each service log = one event (use serviceDate, fall back to nextVisit for todos)
              for (const log of serviceLogs) {
                const isTodo = !!(log.nextVisit && log.paymentStatus === "pending");
                const when = isTodo
                  ? new Date(log.nextVisit!)
                  : new Date(log.serviceDate);
                events.push({
                  id: `log-${log.id}`,
                  date: when,
                  kind: isTodo ? "upcoming" : "service",
                  log,
                });
              }

              // Newest first
              events.sort((a, b) => b.date.getTime() - a.date.getTime());
              const visible = showAllActivity ? events : events.slice(0, 5);

              return (
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-bold text-foreground">Activity Timeline</p>
                    {events.length > 0 && (
                      <span className="text-xs text-muted-foreground">{events.length} {events.length === 1 ? "event" : "events"}</span>
                    )}
                  </div>

                  {events.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border/50 p-5 text-center">
                      <p className="text-sm text-muted-foreground">Abhi koi activity nahi</p>
                      <button onClick={() => setLocation("/app/services")}
                        className="mt-2 text-primary font-bold text-sm flex items-center gap-1 mx-auto">
                        <Plus className="w-4 h-4" /> Pehla kaam add karo
                      </button>
                    </div>
                  ) : (
                    <div className="bg-card rounded-2xl border border-border/50 px-4 py-4">
                      <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border/60" />

                        <div className="space-y-4">
                          {visible.map((ev) => {
                            const log = ev.log;
                            const isPaid  = log?.paymentStatus === "paid";
                            const isPart  = log?.paymentStatus === "partial";
                            const isPend  = log?.paymentStatus === "pending";

                            // Visual config per event type
                            let dotClass = "bg-muted text-muted-foreground";
                            let icon: React.ReactNode = <Clock className="w-3.5 h-3.5" />;
                            let title = "";
                            let subtitle = "";

                            if (ev.kind === "created") {
                              dotClass = "bg-primary/15 text-primary";
                              icon = <UserPlus className="w-3.5 h-3.5" />;
                              title = "Customer added";
                              subtitle = "Khata shuru kiya";
                            } else if (ev.kind === "upcoming") {
                              dotClass = "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
                              icon = <Wrench className="w-3.5 h-3.5" />;
                              title = `Upcoming: ${log!.service}`;
                              subtitle = "Kaam karna hai";
                            } else if (isPaid) {
                              dotClass = "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
                              icon = <CheckCircle2 className="w-3.5 h-3.5" />;
                              title = log!.service;
                              subtitle = "Kaam hua · Paid";
                            } else if (isPart) {
                              dotClass = "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
                              icon = <SplitSquareHorizontal className="w-3.5 h-3.5" />;
                              title = log!.service;
                              subtitle = "Kaam hua · Partial payment";
                            } else if (isPend) {
                              dotClass = "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";
                              icon = <Clock className="w-3.5 h-3.5" />;
                              title = log!.service;
                              subtitle = "Kaam hua · Payment pending";
                            } else {
                              dotClass = "bg-muted text-muted-foreground";
                              icon = <Hammer className="w-3.5 h-3.5" />;
                              title = log!.service;
                              subtitle = "Kaam hua";
                            }

                            const amount = log?.amount;
                            const paidAmt = isPaid ? amount : isPart ? log?.paidAmount : 0;
                            const dueAmt = isPend ? amount : isPart && amount ? amount - (log?.paidAmount ?? 0) : 0;

                            return (
                              <div key={ev.id} className="relative pl-10">
                                {/* Dot */}
                                <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-card ${dotClass}`}>
                                  {icon}
                                </div>

                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{title}</p>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{subtitle}</p>
                                    {log?.note && (
                                      <p className="text-[11px] text-muted-foreground/80 italic mt-1 line-clamp-2">"{log.note}"</p>
                                    )}
                                    <p className="text-[10px] text-muted-foreground/70 font-medium mt-1 flex items-center gap-1">
                                      <CalendarDays className="w-2.5 h-2.5" />
                                      {format(ev.date, "EEE, d MMM yyyy")}
                                    </p>
                                  </div>

                                  {amount != null && amount > 0 && (
                                    <div className="text-right flex-shrink-0">
                                      {paidAmt ? (
                                        <p className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center justify-end gap-0.5">
                                          <IndianRupee className="w-2.5 h-2.5" />{paidAmt.toLocaleString()}
                                        </p>
                                      ) : null}
                                      {dueAmt > 0 && (
                                        <p className="text-[11px] font-semibold text-orange-500 flex items-center justify-end gap-0.5">
                                          <IndianRupee className="w-2.5 h-2.5" />{dueAmt.toLocaleString()} due
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {events.length > 5 && (
                        <button
                          onClick={() => setShowAllActivity(v => !v)}
                          className="w-full mt-3 pt-3 border-t border-border/40 text-xs text-primary font-bold flex items-center justify-center gap-1 hover:bg-primary/5 rounded-xl py-2 transition-colors"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllActivity ? "rotate-180" : ""}`} />
                          {showAllActivity ? "Kam dikhao" : `Saari ${events.length} dikhao`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ⑤  MONEY SUMMARY (bottom, secondary) ─────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-900/15 rounded-2xl p-4 border border-green-100 dark:border-green-800/30 text-center">
                <p className="text-[11px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">Total Kamaya</p>
                <p className="text-2xl font-display font-bold text-green-600 dark:text-green-400 mt-1">
                  ₹{totalEarned.toLocaleString()}
                </p>
              </div>
              <div className={`rounded-2xl p-4 border text-center ${
                balanceDue > 0
                  ? "bg-orange-50 dark:bg-orange-900/15 border-orange-100 dark:border-orange-800/30"
                  : "bg-card border-border/50"
              }`}>
                <p className={`text-[11px] font-bold uppercase tracking-wide ${balanceDue > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                  Baaki Baki Hai
                </p>
                <p className={`text-2xl font-display font-bold mt-1 ${balanceDue > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                  ₹{balanceDue.toLocaleString()}
                </p>
              </div>
            </div>

            {/* ⑥  NOTES (if any) ───────────────────────────────── */}
            {customer.notes && (
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-200/50 flex gap-3">
                <StickyNote className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/90 leading-relaxed">{customer.notes}</p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
