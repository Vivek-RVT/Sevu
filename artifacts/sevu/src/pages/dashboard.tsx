import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, isThisMonth, isWithinInterval, addDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import {
  useGetDashboard,
  useGetBusiness,
  useLogReminderSent,
  useMarkServiceDone,
  useLogReviewSent
} from "@workspace/api-client-react";
import { useBusinessId } from "@/lib/store";
import { getWhatsAppLink, formatReminderMessage, formatReviewMessage } from "@/lib/whatsapp";
import {
  Bell, CheckCircle2, MessageCircle, Star, Users, Loader2, Plus,
  IndianRupee, Clock, CalendarDays, TrendingUp, ClipboardList,
  ChevronRight, Cake, Sparkles, ArrowUpRight, Wrench
} from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { haptic } from "@/lib/haptic";

interface ServiceLog {
  id: number;
  customerId?: number;
  customerName: string;
  service: string;
  amount?: number;
  paymentStatus: string;
  serviceDate: string;
  nextVisit?: string;
  note?: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  serviceType: string;
  birthday?: string;
  tags?: string;
  nextServiceDate?: string;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className={`rounded-2xl p-4 border flex flex-col gap-1 ${color}`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-70">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-3xl font-display font-bold leading-none tracking-tight">{value}</span>
      {sub && <span className="text-[11px] opacity-60 font-light mt-1">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const { businessId } = useBusinessId();
  const [, setLocation] = useLocation();
  const [markedDoneIds, setMarkedDoneIds] = useState<Set<number>>(new Set());

  if (!businessId) return <Redirect to="/app/login" />;

  const { data: dashboard, isLoading: isDashLoading, refetch } = useGetDashboard(
    { businessId },
    { query: { staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true } },
  );
  const { data: business, isLoading: isBizLoading } = useGetBusiness(
    businessId,
    { query: { staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true } },
  );

  const { data: serviceLogs = [] } = useQuery<ServiceLog[]>({
    queryKey: ["service-logs-dash", businessId],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch(`/api/service-logs?businessId=${businessId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    }
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-dash", businessId],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch(`/api/customers?businessId=${businessId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    }
  });

  const logReminder = useLogReminderSent();
  const logReview = useLogReviewSent();
  const markDone = useMarkServiceDone();

  const handleSendReminder = async (customer: any) => {
    if (!business) return;
    haptic("light");
    const template = business.defaultReminderMessage || "Hi [Name], your [ServiceType] service is due. Visit again 😊";
    const msg = formatReminderMessage(template, customer.name, customer.serviceType);
    window.open(getWhatsAppLink(customer.phone, msg), "_blank");
    try {
      await logReminder.mutateAsync({ data: { customerId: customer.id, businessId } });
      refetch();
    } catch (e) { console.error(e); }
  };

  const handleMarkDone = async (customerId: number) => {
    haptic("success");
    try {
      await markDone.mutateAsync({ id: customerId });
      setMarkedDoneIds(prev => new Set([...prev, customerId]));
      refetch();
    } catch (e) { console.error(e); }
  };

  const handleSendReviewRequest = async (customer: any) => {
    if (!business) return;
    haptic("light");
    const template = business.defaultReviewMessage || "Thank you for your visit 🙏 Please rate our service ⭐ [Review Link]";
    const msg = formatReviewMessage(template, business.reviewLink || "");
    window.open(getWhatsAppLink(customer.phone, msg), "_blank");
    try {
      await logReview.mutateAsync({ data: { customerId: customer.id, businessId } });
      setMarkedDoneIds(prev => { const n = new Set(prev); n.delete(customer.id); return n; });
      refetch();
    } catch (e) { console.error(e); }
  };

  if (isDashLoading || isBizLoading) {
    return (
      <MobileLayout>
        <div className="flex h-full min-h-[60vh] items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
        </div>
      </MobileLayout>
    );
  }

  const reminders = dashboard?.todayReminders || [];
  const today = new Date();

  // --- Computed stats from service logs ---
  const thisMonthLogs = serviceLogs.filter(l => isThisMonth(new Date(l.serviceDate)));
  const monthEarned = thisMonthLogs.filter(l => l.paymentStatus === "paid").reduce((s, l) => s + (l.amount || 0), 0);
  const totalPendingAmt = serviceLogs.filter(l => l.paymentStatus === "pending").reduce((s, l) => s + (l.amount || 0), 0);
  const monthJobs = thisMonthLogs.length;

  // --- Upcoming services from customers.nextServiceDate (next 14 days, not today) ---
  const upcomingServices = customers
    .filter(c => {
      if (!c.nextServiceDate) return false;
      const d = new Date(c.nextServiceDate);
      const daysAway = differenceInDays(startOfDay(d), startOfDay(today));
      return daysAway > 0 && daysAway <= 14;
    })
    .sort((a, b) => new Date(a.nextServiceDate!).getTime() - new Date(b.nextServiceDate!).getTime());

  // --- Upcoming visits (next 7 days) ---
  const upcomingVisits = serviceLogs
    .filter(l => l.nextVisit && isWithinInterval(new Date(l.nextVisit), {
      start: startOfDay(new Date()),
      end: endOfDay(addDays(new Date(), 7))
    }))
    .sort((a, b) => new Date(a.nextVisit!).getTime() - new Date(b.nextVisit!).getTime())
    .slice(0, 4);

  // --- Birthday this week ---
  const birthdayCustomers = customers.filter(c => {
    if (!c.birthday) return false;
    const bday = new Date(c.birthday);
    const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    return differenceInDays(thisYearBday, today) >= 0 && differenceInDays(thisYearBday, today) <= 7;
  });

  // --- Recent services (last 4) ---
  const recentServices = [...serviceLogs].slice(0, 4);

  return (
    <MobileLayout>
      <div className="p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">

        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-5 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -right-2 -bottom-8 w-20 h-20 bg-white/5 rounded-full" />
          <p className="text-white/80 text-sm font-medium mb-0.5">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="text-2xl font-display font-bold leading-tight">
            {greeting()},<br />
            <span className="text-white/90">{business?.name || "your shop"} 👋</span>
          </h1>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => { haptic("light"); setLocation("/app/customers/new"); }}
              className="flex-1 bg-white text-primary py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Customer
            </button>
            <button
              onClick={() => { haptic("light"); setLocation("/app/services"); }}
              className="flex-1 bg-transparent text-white border-2 border-white/50 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-white/10"
            >
              <ClipboardList className="w-4 h-4" /> Log Service
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Users className="w-3.5 h-3.5" />}
            label="Customers"
            value={dashboard?.totalCustomers || 0}
            sub="total in your khata"
            color="bg-card border-border/50 text-foreground"
          />
          <StatCard
            icon={<ClipboardList className="w-3.5 h-3.5" />}
            label="This Month"
            value={monthJobs}
            sub={`${thisMonthLogs.filter(l => l.paymentStatus === "paid").length} paid`}
            color="bg-primary/8 dark:bg-primary/15 border-primary/20 text-primary dark:text-primary"
          />
          <StatCard
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            label="Earned"
            value={monthEarned > 0 ? `₹${monthEarned.toLocaleString()}` : "₹0"}
            sub="this month (paid)"
            color="bg-green-50 dark:bg-green-900/20 border-green-200/50 text-green-700 dark:text-green-300"
          />
          <StatCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Pending"
            value={totalPendingAmt > 0 ? `₹${totalPendingAmt.toLocaleString()}` : dashboard?.pendingFollowups || 0}
            sub={totalPendingAmt > 0 ? "to collect" : "follow-ups"}
            color="bg-orange-50 dark:bg-orange-900/20 border-orange-200/50 text-orange-600 dark:text-orange-300"
          />
        </div>

        {/* Birthday Alert */}
        {birthdayCustomers.length > 0 && (
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-2xl p-4 border border-pink-200/50 flex items-start gap-3">
            <Cake className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-pink-700 dark:text-pink-300 text-sm">Birthday this week!</p>
              {birthdayCustomers.map(c => {
                const bday = new Date(c.birthday!);
                const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                const daysLeft = differenceInDays(thisYearBday, today);
                return (
                  <div key={c.id} className="flex items-center justify-between mt-1.5">
                    <span className="text-sm text-pink-600 dark:text-pink-400 font-medium">
                      {c.name} — {daysLeft === 0 ? "Today! 🎉" : `in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`}
                    </span>
                    <button
                      onClick={() => window.open(getWhatsAppLink(c.phone, `Happy Birthday ${c.name}! 🎂🎉`), "_blank")}
                      className="text-xs bg-pink-500 text-white px-2.5 py-1 rounded-full font-bold active:scale-95"
                    >
                      Wish 🎁
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Visits */}
        {upcomingVisits.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-secondary" />
                Upcoming Visits
              </h2>
              <span className="text-xs text-muted-foreground font-medium">next 7 days</span>
            </div>
            <div className="space-y-2">
              {upcomingVisits.map(log => {
                const daysAway = differenceInDays(new Date(log.nextVisit!), startOfDay(new Date()));
                return (
                  <div key={log.id} className="bg-card rounded-2xl border border-border/50 px-4 py-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center ${daysAway === 0 ? "bg-secondary text-white" : "bg-secondary/10 text-secondary"}`}>
                      <span className="text-[10px] font-bold leading-none">{format(new Date(log.nextVisit!), "MMM").toUpperCase()}</span>
                      <span className="text-base font-bold leading-none">{format(new Date(log.nextVisit!), "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{log.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Wrench className="w-3 h-3" />{log.service}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      daysAway === 0 ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                    }`}>
                      {daysAway === 0 ? "Today" : `in ${daysAway}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Services */}
        {upcomingServices.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-secondary" />
                Upcoming Services
              </h2>
              <span className="text-xs text-muted-foreground font-medium">next 14 days</span>
            </div>
            <div className="space-y-2">
              {upcomingServices.map(c => {
                const d = new Date(c.nextServiceDate!);
                const daysAway = differenceInDays(startOfDay(d), startOfDay(today));
                const isUrgent = daysAway <= 3;
                return (
                  <div key={c.id} className={`bg-card rounded-2xl border px-4 py-3 flex items-center gap-3 ${isUrgent ? "border-orange-200/60" : "border-border/50"}`}>
                    {/* Date pill */}
                    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isUrgent ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : "bg-secondary/10 text-secondary"}`}>
                      <span className="text-[9px] font-bold leading-none uppercase">{format(d, "MMM")}</span>
                      <span className="text-base font-bold leading-none">{format(d, "d")}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Wrench className="w-3 h-3 flex-shrink-0" />{c.serviceType}
                      </p>
                    </div>

                    {/* Days away + WhatsApp */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        daysAway <= 1 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : daysAway <= 3 ? "bg-orange-100 text-orange-600"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {daysAway === 1 ? "Tomorrow" : `${daysAway}d`}
                      </span>
                      <button
                        onClick={() => {
                          const msg = formatReminderMessage(
                            business?.defaultReminderMessage || "Hi [Name], your [ServiceType] service is due soon. Book your slot! 😊",
                            c.name, c.serviceType
                          );
                          window.open(getWhatsAppLink(c.phone, msg), "_blank");
                        }}
                        className="w-8 h-8 bg-[#25D366]/10 text-[#25D366] rounded-xl flex items-center justify-center hover:bg-[#25D366]/20 active:scale-95 transition-all border border-[#25D366]/20"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Today's Reminders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Today's Reminders
              {reminders.length > 0 && (
                <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {reminders.length}
                </span>
              )}
            </h2>
          </div>

          {reminders.length === 0 ? (
            <div className="bg-card border border-dashed border-border p-6 rounded-2xl text-center flex flex-col items-center justify-center opacity-80">
              <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
              <h3 className="font-bold text-foreground">All caught up!</h3>
              <p className="text-sm text-muted-foreground mt-1">No reminders scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((customer) => {
                const isDone = markedDoneIds.has(customer.id);
                return (
                  <div key={customer.id} className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold font-display flex-shrink-0">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate">{customer.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Wrench className="w-3 h-3" />{customer.serviceType}
                        </p>
                      </div>
                      <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded-lg">
                        {customer.phone}
                      </span>
                    </div>

                    {!isDone ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendReminder(customer)}
                          className="flex-1 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95 border border-[#25D366]/20"
                        >
                          <MessageCircle className="w-4 h-4" /> Remind
                        </button>
                        <button
                          onClick={() => handleMarkDone(customer.id)}
                          disabled={markDone.isPending}
                          className="flex-1 bg-muted text-foreground hover:bg-border py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Mark Done
                        </button>
                      </div>
                    ) : (
                      <div className="animate-in fade-in zoom-in-95 duration-300 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-green-600 font-bold bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Service Marked Done
                        </div>
                        <button
                          onClick={() => handleSendReviewRequest(customer)}
                          className="w-full bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95 text-sm"
                        >
                          <Star className="w-4 h-4 fill-current" /> Ask for Review
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Services */}
        {recentServices.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Recent Services
              </h2>
              <button
                onClick={() => setLocation("/app/services")}
                className="text-primary text-xs font-bold flex items-center gap-1"
              >
                View all <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/40">
              {recentServices.map(log => (
                <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.paymentStatus === "paid" ? "bg-green-500" : "bg-orange-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{log.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{log.service} · {format(new Date(log.serviceDate), "dd MMM")}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {log.amount != null && log.amount > 0 && (
                      <span className="text-sm font-bold text-foreground">₹{log.amount.toLocaleString()}</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      log.paymentStatus === "paid"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-600"
                    }`}>
                      {log.paymentStatus === "paid" ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </MobileLayout>
  );
}
