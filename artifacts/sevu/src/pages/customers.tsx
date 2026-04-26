import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useListCustomers } from "@workspace/api-client-react";
import { useBusinessId } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { ListSkeleton } from "@/components/skeletons";
import { Search, Plus, IndianRupee, CalendarDays, AlertCircle, Info, X, Phone, Mail, MapPin, Cake, Wrench, StickyNote, Tag, Hash } from "lucide-react";
import { format, isBefore, addDays, differenceInDays } from "date-fns";
import { useDebounce } from "@/lib/use-debounce";

const TAG_FILTERS = ["All", "VIP", "Regular", "New", "Walk-in"];

// ── Auto-tag logic ── derived 100% from existing customer data, no manual input needed
function getAutoTags(customer: {
  phone: string; totalSpent?: number | null;
  createdAt: string; tags?: string | null;
}): string[] {
  const computed: string[] = [];
  const daysSinceCreated = differenceInDays(new Date(), new Date(customer.createdAt));
  const spent = customer.totalSpent ?? 0;

  if (!customer.phone || customer.phone === "")  computed.push("Walk-in");
  if (daysSinceCreated <= 45)                    computed.push("New");
  if (spent >= 5000)                             computed.push("VIP");
  else if (spent > 0 && daysSinceCreated > 45)   computed.push("Regular");

  // Preserve manually-set tags (Referred, Corporate, etc.) from DB
  if (customer.tags) {
    for (const t of customer.tags.split(",").map(s => s.trim()).filter(Boolean)) {
      if (!computed.includes(t)) computed.push(t);
    }
  }

  return computed;
}


function getStatus(nextServiceDate: string | null | undefined) {
  if (!nextServiceDate) return { label: "Active", color: "green" } as const;
  const next = new Date(nextServiceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isBefore(next, today)) return { label: "Follow-up due", color: "red" } as const;
  if (isBefore(next, addDays(today, 7))) return { label: "Due soon", color: "orange" } as const;
  return { label: "Active", color: "green" } as const;
}

const STATUS_STYLES = {
  green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  red:    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_DOT = {
  green:  "bg-green-500",
  orange: "bg-orange-500",
  red:    "bg-red-500",
};

export default function Customers() {
  const { businessId } = useBusinessId();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const debouncedSearch = useDebounce(search, 300);
  const [infoCustomer, setInfoCustomer] = useState<any | null>(null);

  if (!businessId) return <Redirect to="/app/login" />;

  const { data: customers = [], isLoading } = useListCustomers(
    { businessId, search: debouncedSearch || undefined },
    {
      query: {
        // Treat data as fresh for 30s so a freshly-injected optimistic entry
        // (from /app/customers/new) isn't immediately wiped by a mount-time
        // refetch that races with the still-pending POST.
        staleTime: 30_000,
        // Only refetch on mount if the cache is actually stale.
        refetchOnMount: true,
        refetchOnWindowFocus: true,
      },
    },
  );

  const visibleCustomers = activeTag === "All"
    ? customers
    : customers.filter(c => getAutoTags(c).includes(activeTag));

  const followUpCount = customers.filter(c => {
    if (!c.nextServiceDate) return false;
    const next = new Date(c.nextServiceDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return isBefore(next, today);
  }).length;

  return (
    <MobileLayout>
      <div className="p-4 flex flex-col h-full min-h-screen relative">

        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-xl z-20 pb-3 pt-2 -mx-4 px-4">

          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Customers</h1>
              {followUpCount > 0 && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3" />
                  {followUpCount} follow-up{followUpCount > 1 ? "s" : ""} overdue
                </p>
              )}
            </div>
            <button
              onClick={() => { haptic("light"); setLocation("/app/customers/new"); }}
              className="w-10 h-10 bg-gradient-to-br from-primary to-secondary text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl active:scale-90 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border-2 border-border/60 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-muted-foreground text-sm font-medium shadow-sm"
            />
          </div>

          {/* Tag chips */}
          <div className="flex flex-wrap gap-2">
            {TAG_FILTERS.map(tag => (
              <button key={tag} onClick={() => { haptic("light"); setActiveTag(tag); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border active:scale-95 ${
                  activeTag === tag ? "bg-primary text-white border-primary shadow-sm" : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
                }`}>
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 pb-24 mt-1">
          {isLoading ? (
            <ListSkeleton rows={6} />
          ) : visibleCustomers.length === 0 ? (
            <div className="text-center pt-16 px-4">
              <img src={`${import.meta.env.BASE_URL}images/empty-customers.png`} alt="No customers"
                className="w-40 h-40 mx-auto opacity-80 mix-blend-multiply dark:mix-blend-normal mb-5 drop-shadow-xl" />
              {search || activeTag !== "All" ? (
                <>
                  <h3 className="text-xl font-bold">Koi match nahi mila</h3>
                  <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm font-light">
                    Search ya filter change karo — customer zaroor milega 😊
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-display font-bold">Pehla customer add karo 🎯</h3>
                  <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm font-light leading-relaxed">
                    Apni khata shuru karo — har customer, har rupaya, sab track hoga
                  </p>
                  <button onClick={() => { haptic("light"); setLocation("/app/customers/new"); }}
                    className="mt-5 px-6 py-3.5 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 mx-auto active:scale-95 transition-all">
                    <Plus className="w-5 h-5" /> Pehla Customer Add Karo
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(search || activeTag !== "All") && (
                <p className="text-xs text-muted-foreground font-medium ml-1">
                  {visibleCustomers.length} result{visibleCustomers.length !== 1 ? "s" : ""}
                </p>
              )}

              {visibleCustomers.map(customer => {
                const status = getStatus(customer.nextServiceDate);
                const hasEarned = customer.totalSpent != null && customer.totalSpent > 0;
                const hasNext = !!customer.nextServiceDate;

                return (
                  <div key={customer.id}
                    onClick={() => { if (customer.id > 0) { haptic("light"); setLocation(`/app/customers/${customer.id}`); } }}
                    className={`bg-card px-4 py-3.5 rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group active:scale-[0.98] ${customer.id > 0 ? "cursor-pointer" : "cursor-wait opacity-70"}`}>

                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center text-primary font-display font-bold text-lg flex-shrink-0 mt-0.5">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground text-base leading-tight">{customer.name}</h3>
                        </div>

                        {/* Phone + address */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {customer.phone ? (
                            <span className="text-xs text-muted-foreground font-medium">{customer.phone}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">No phone</span>
                          )}
                          {customer.address && (
                            <>
                              <span className="text-muted-foreground/30 text-xs">·</span>
                              <span className="text-xs text-muted-foreground/80 truncate max-w-[120px]">{customer.address}</span>
                            </>
                          )}
                        </div>

                        {/* Income + date signals */}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {hasEarned && (
                            <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                              <IndianRupee className="w-3 h-3" />
                              {customer.totalSpent!.toLocaleString()} earned
                            </span>
                          )}
                          {hasNext && (
                            <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
                              <CalendarDays className="w-3 h-3" />
                              Next: {format(new Date(customer.nextServiceDate!), "d MMM")}
                            </span>
                          )}
                          {customer.outstandingBalance != null && customer.outstandingBalance > 0 && (
                            <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-500">
                              <IndianRupee className="w-3 h-3" />
                              {customer.outstandingBalance.toLocaleString()} due
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: status + info */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLES[status.color]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status.color]}`} />
                          {status.label}
                        </div>
                        {customer.id > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); haptic("light"); setInfoCustomer(customer); }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 active:scale-95 transition"
                            aria-label="View customer info"
                          >
                            <Info className="w-3 h-3" />
                            Info
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Customer Info Modal ─────────────────────────────────── */}
      {infoCustomer && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setInfoCustomer(null)}
        >
          <div
            className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border/50 max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center text-primary font-display font-bold text-xl flex-shrink-0">
                {infoCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold text-lg leading-tight truncate">{infoCustomer.name}</h2>
                <p className="text-xs text-muted-foreground font-medium">Customer details</p>
              </div>
              <button
                onClick={() => setInfoCustomer(null)}
                className="w-9 h-9 rounded-full hover:bg-muted active:scale-95 flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {(() => {
                const c = infoCustomer;
                const tagsAuto = getAutoTags(c);
                type Row = { icon: any; label: string; value: React.ReactNode; tone?: string };
                const rows: Row[] = [];

                rows.push({ icon: Phone, label: "Phone", value: c.phone || <span className="italic text-muted-foreground/60">Not set</span> });
                if (c.email)        rows.push({ icon: Mail, label: "Email", value: c.email });
                if (c.address)      rows.push({ icon: MapPin, label: "Address", value: c.address });
                if (c.birthday)     rows.push({ icon: Cake, label: "Birthday", value: format(new Date(c.birthday), "d MMM yyyy") });
                if (c.serviceType)  rows.push({ icon: Wrench, label: "Service type", value: c.serviceType });
                if (c.lastServiceDate) rows.push({ icon: CalendarDays, label: "Last service", value: format(new Date(c.lastServiceDate), "d MMM yyyy") });
                if (c.nextServiceDate) rows.push({ icon: CalendarDays, label: "Next service", value: format(new Date(c.nextServiceDate), "d MMM yyyy") });

                return (
                  <>
                    {/* Money summary */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3 border border-green-100 dark:border-green-900/30">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">Total Earned</p>
                        <p className="text-xl font-display font-bold text-green-600 dark:text-green-400 mt-0.5 flex items-center">
                          <IndianRupee className="w-4 h-4" />{(c.totalSpent ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div className={`rounded-2xl p-3 border ${
                        (c.outstandingBalance ?? 0) > 0
                          ? "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30"
                          : "bg-muted/40 border-border/40"
                      }`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${
                          (c.outstandingBalance ?? 0) > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                        }`}>Balance Due</p>
                        <p className={`text-xl font-display font-bold mt-0.5 flex items-center ${
                          (c.outstandingBalance ?? 0) > 0 ? "text-orange-500" : "text-muted-foreground"
                        }`}>
                          <IndianRupee className="w-4 h-4" />{(c.outstandingBalance ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Tags */}
                    {tagsAuto.length > 0 && (
                      <div className="bg-muted/40 rounded-2xl px-3 py-2.5 flex items-start gap-2.5">
                        <Tag className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Tags</p>
                          <div className="flex flex-wrap gap-1">
                            {tagsAuto.map(t => (
                              <span key={t} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detail rows */}
                    {rows.map((r, i) => (
                      <div key={i} className="bg-muted/30 rounded-2xl px-3 py-2.5 flex items-start gap-2.5">
                        <r.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{r.label}</p>
                          <p className="text-sm font-semibold text-foreground break-words">{r.value}</p>
                        </div>
                      </div>
                    ))}

                    {/* Notes */}
                    {c.notes && (
                      <div className="bg-muted/30 rounded-2xl px-3 py-2.5 flex items-start gap-2.5">
                        <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Notes</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{c.notes}</p>
                        </div>
                      </div>
                    )}

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
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/50 flex gap-2">
              <button
                onClick={() => setInfoCustomer(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98] transition"
              >
                Close
              </button>
              {infoCustomer.id > 0 && (
                <button
                  onClick={() => {
                    const id = infoCustomer.id;
                    setInfoCustomer(null);
                    haptic("light");
                    setLocation(`/app/customers/${id}`);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition"
                >
                  Open full page
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
