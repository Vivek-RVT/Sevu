import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { ServicesSkeleton } from "@/components/skeletons";
import { useBusinessId } from "@/lib/store";
import {
  useListCustomers,
  useListServiceLogs,
  createServiceLog,
  deleteServiceLog,
  updateServiceLog,
  getListServiceLogsQueryKey,
  type ServiceLog,
} from "@workspace/api-client-react";
import { haptic } from "@/lib/haptic";
import {
  Plus, X, CheckCircle2, Clock, Trash2,
  CalendarDays, IndianRupee, Loader2,
  User, TrendingUp, Wallet, AlertCircle, ChevronRight,
  ChevronDown, SplitSquareHorizontal, StickyNote,
  Wrench, Bell, Eye, Hammer
} from "lucide-react";
import { format, isToday, isSameMonth } from "date-fns";

type DrawerStep = "customer" | "flowSelect" | "details";
type FlowType = "done" | "todo";
type PayStatus = "paid" | "pending" | "partial";

const TODAY = new Date().toISOString().split("T")[0];

export default function Services() {
  const { businessId } = useBusinessId();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [markingCompleteId, setMarkingCompleteId] = useState<number | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [completionError, setCompletionError] = useState<{ logId: number; message: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ServiceLog | null>(null);
  const [workDoneLog, setWorkDoneLog] = useState<ServiceLog | null>(null);

  // Drive 1-Hz refresh so the 10-minute undo countdown timer ticks down live.
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-clear inline completion error after 4 seconds
  useEffect(() => {
    if (!completionError) return;
    const t = setTimeout(() => setCompletionError(null), 4000);
    return () => clearTimeout(t);
  }, [completionError]);
  const [workDonePayStatus, setWorkDonePayStatus] = useState<PayStatus>("paid");
  const [workDonePaidAmount, setWorkDonePaidAmount] = useState("");
  const [workDoneDueDate, setWorkDoneDueDate] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStep, setDrawerStep] = useState<DrawerStep>("customer");
  const [flowType, setFlowType] = useState<FlowType | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const jobInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const t = setTimeout(() => {
      if (drawerStep === "customer") searchInputRef.current?.focus();
      else if (drawerStep === "details" && flowType === "done") amountInputRef.current?.focus();
      else if (drawerStep === "details" && flowType === "todo") jobInputRef.current?.focus();
    }, 320);
    return () => clearTimeout(t);
  }, [drawerOpen, drawerStep, flowType]);

  const [form, setForm] = useState({
    customerId: undefined as number | undefined,
    customerName: "",
    service: "",
    amount: "",
    paidAmount: "",
    paymentStatus: "paid" as PayStatus,
    paymentDueDate: "",
    jobDate: "",
    note: "",
  });

  const safeBusinessId = businessId ?? 0;
  const logsQueryKey = getListServiceLogsQueryKey({ businessId: safeBusinessId });

  const { data: logs = [], isLoading } = useListServiceLogs(
    { businessId: safeBusinessId },
    { query: { staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true } },
  );

  const { data: customers = [], isLoading: customersLoading } = useListCustomers(
    { businessId: safeBusinessId },
    { query: { enabled: safeBusinessId > 0, staleTime: 0, refetchOnMount: "always" } },
  );

  const createLog = useMutation({
    mutationFn: (data: Parameters<typeof createServiceLog>[0]) => createServiceLog(data),
    onMutate: async (data) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic entry
      await queryClient.cancelQueries({ queryKey: logsQueryKey });

      // Snapshot current data for rollback
      const prev = queryClient.getQueryData<ServiceLog[]>(logsQueryKey);

      // Build and inject the optimistic entry
      const tempId = -Date.now();
      const tempLog: ServiceLog = {
        id: tempId,
        businessId: (data as any).businessId ?? safeBusinessId,
        customerId: (data as any).customerId ?? undefined,
        customerName: (data as any).customerName ?? "",
        service: (data as any).service || "General Service",
        amount: (data as any).amount ?? undefined,
        paidAmount: (data as any).paidAmount ?? undefined,
        paymentStatus: (data as any).paymentStatus ?? "paid",
        serviceDate: (data as any).serviceDate ?? new Date().toISOString(),
        paymentDate: (data as any).paymentDate ?? undefined,
        nextVisit: (data as any).nextVisit ?? undefined,
        note: (data as any).note ?? undefined,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old => [tempLog, ...(old ?? [])]);

      return { prev, tempId };
    },
    onSuccess: (realLog, _vars, ctx) => {
      const tempId = ctx?.tempId as number | undefined;
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old => {
        const list = old ?? [];
        if (tempId !== undefined && list.some(l => l.id === tempId)) {
          // Happy path: replace the temp entry with the real server entry
          return list.map(l => l.id === tempId ? (realLog as ServiceLog) : l);
        }
        // Temp entry was evicted by a racing refetch — add the real entry if not already present
        return list.some(l => l.id === (realLog as ServiceLog).id)
          ? list
          : [(realLog as ServiceLog), ...list];
      });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(logsQueryKey, ctx.prev);
    },
    onSettled: () => {
      // Always force a fresh fetch on EVERY related query (active + inactive),
      // so re-opening Services / Dashboard / Customer detail shows the new item.
      queryClient.invalidateQueries({ queryKey: logsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/service-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-dash"] });
      queryClient.invalidateQueries({ queryKey: ["customers-dash"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-customer"] });
      queryClient.invalidateQueries({
        predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/customers/"),
      });
    },
  });

  const deleteLog = useMutation({
    mutationFn: (id: number) => deleteServiceLog(id),
    onMutate: async (id: number) => {
      if (deletingId === id) return; // prevent double-fire
      setDeletingId(id);
      await queryClient.cancelQueries({ queryKey: logsQueryKey });
      const prev = queryClient.getQueryData<ServiceLog[]>(logsQueryKey);
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old => (old ?? []).filter(l => l.id !== id));
      return { prev };
    },
    onError: (_err: unknown, _id: unknown, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(logsQueryKey, ctx.prev);
    },
    onSettled: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: logsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/service-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-dash"] });
      queryClient.invalidateQueries({ queryKey: ["customers-dash"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-customer"] });
      queryClient.invalidateQueries({
        predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/customers/"),
      });
    },
  });

  const togglePayment = useMutation({
    mutationFn: ({ id, currentStatus }: { id: number; currentStatus: string }) => {
      const newStatus = currentStatus === "paid" ? "pending" : "paid";
      return updateServiceLog(id, { paymentStatus: newStatus });
    },
    onMutate: async ({ id, currentStatus }: { id: number; currentStatus: string }) => {
      haptic("success");
      setTogglingId(id);
      await queryClient.cancelQueries({ queryKey: logsQueryKey });
      const prev = queryClient.getQueryData<ServiceLog[]>(logsQueryKey);
      const newStatus = currentStatus === "paid" ? "pending" : "paid";
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old =>
        (old ?? []).map(l => l.id === id ? { ...l, paymentStatus: newStatus } : l)
      );
      return { prev };
    },
    onError: (_err: unknown, _vars: unknown, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(logsQueryKey, ctx.prev);
    },
    onSettled: () => {
      setTogglingId(null);
      queryClient.invalidateQueries({ queryKey: logsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/service-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-dash"] });
      queryClient.invalidateQueries({ queryKey: ["customers-dash"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-customer"] });
      queryClient.invalidateQueries({
        predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/customers/"),
      });
    },
  });

  // ── Mark Complete (separate from payment) ──────────────────────────────────
  const markComplete = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/service-logs/${id}/complete`, {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw { message: body?.message || body?.error || "Complete mark nahi ho saka." };
      }
      return body as { log: ServiceLog & { completionStatus: string; completedAt: string } };
    },
    onMutate: async (id: number) => {
      haptic("success");
      setMarkingCompleteId(id);
      setCompletionError(null);
      await queryClient.cancelQueries({ queryKey: logsQueryKey });
      const prev = queryClient.getQueryData<ServiceLog[]>(logsQueryKey);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old =>
        (old ?? []).map(l => l.id === id ? { ...l, completionStatus: "completed", completedAt: nowIso } as ServiceLog : l)
      );
      return { prev };
    },
    onSuccess: (data) => {
      // Replace optimistic record with authoritative server copy (includes serverTime)
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old =>
        (old ?? []).map(l => l.id === data.log.id ? (data.log as ServiceLog) : l)
      );
    },
    onError: (err: any, id: number, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(logsQueryKey, ctx.prev);
      setCompletionError({ logId: id, message: err?.message || "Complete mark nahi ho saka." });
    },
    onSettled: () => {
      setMarkingCompleteId(null);
      queryClient.invalidateQueries({ queryKey: logsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/service-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
    },
  });

  const undoComplete = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/service-logs/${id}/undo-complete`, {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw { message: body?.message || body?.error || "Undo nahi ho saka." };
      }
      return body as { log: ServiceLog };
    },
    onMutate: async (id: number) => {
      haptic("light");
      setUndoingId(id);
      await queryClient.cancelQueries({ queryKey: logsQueryKey });
      const prev = queryClient.getQueryData<ServiceLog[]>(logsQueryKey);
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old =>
        (old ?? []).map(l => l.id === id ? { ...l, completionStatus: "pending", completedAt: null as any } as ServiceLog : l)
      );
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old =>
        (old ?? []).map(l => l.id === data.log.id ? (data.log as ServiceLog) : l)
      );
    },
    onError: (err: any, id: number, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(logsQueryKey, ctx.prev);
      setCompletionError({ logId: id, message: err?.message || "Undo nahi ho saka." });
    },
    onSettled: () => {
      setUndoingId(null);
      queryClient.invalidateQueries({ queryKey: logsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/service-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
    },
  });

  const completeWork = useMutation({
    mutationFn: ({ id, paymentStatus, paidAmount, paymentDate }: {
      id: number; paymentStatus: string; paidAmount?: number; paymentDate?: string;
    }) => updateServiceLog(id, {
      paymentStatus,
      paidAmount: paidAmount ?? undefined,
      paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
      nextVisit: null as any,
    }),
    onMutate: async ({ id, paymentStatus, paidAmount }) => {
      haptic("success");
      setCompletingId(id);
      await queryClient.cancelQueries({ queryKey: logsQueryKey });
      const prev = queryClient.getQueryData<ServiceLog[]>(logsQueryKey);
      queryClient.setQueryData<ServiceLog[]>(logsQueryKey, old =>
        (old ?? []).map(l => l.id === id ? { ...l, paymentStatus, paidAmount: paidAmount ?? l.paidAmount, nextVisit: undefined } : l)
      );
      return { prev };
    },
    onError: (_err: unknown, _vars: unknown, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(logsQueryKey, ctx.prev);
    },
    onSettled: () => {
      setCompletingId(null);
      setWorkDoneLog(null);
      setWorkDonePayStatus("paid");
      setWorkDonePaidAmount("");
      setWorkDoneDueDate("");
      queryClient.invalidateQueries({ queryKey: logsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/service-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-dash"] });
      queryClient.invalidateQueries({ queryKey: ["customers-dash"] });
      queryClient.invalidateQueries({ queryKey: ["service-logs-customer"] });
      queryClient.invalidateQueries({
        predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/customers/"),
      });
    },
  });

  const openWorkDone = (log: ServiceLog) => {
    haptic("medium");
    setWorkDoneLog(log);
    setWorkDonePayStatus("paid");
    setWorkDonePaidAmount("");
    setWorkDoneDueDate("");
  };

  const submitWorkDone = () => {
    if (!workDoneLog) return;
    const paid = workDonePayStatus === "partial" && workDonePaidAmount ? parseFloat(workDonePaidAmount) : undefined;
    completeWork.mutate({
      id: workDoneLog.id,
      paymentStatus: workDonePayStatus,
      paidAmount: paid,
      paymentDate: (workDonePayStatus === "pending" || workDonePayStatus === "partial") && workDoneDueDate ? workDoneDueDate : undefined,
    });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerStep("customer");
    setFlowType(null);
    setCustomerSearch("");
    setForm({ customerId: undefined, customerName: "", service: "", amount: "", paidAmount: "", paymentStatus: "paid", paymentDueDate: "", jobDate: "", note: "" });
  };

  const openDrawer = () => { setDrawerOpen(true); setDrawerStep("customer"); };

  const submitWithOptimisticUpdate = (mutationData: Parameters<typeof createServiceLog>[0]) => {
    // Close drawer first for immediate responsiveness, then fire the mutation.
    // The optimistic cache update + cancel-queries guard lives in createLog.onMutate.
    closeDrawer();
    createLog.mutate(mutationData as any);
  };

  const handleSubmitDone = () => {
    if (!form.customerName.trim()) return;
    const amt = form.amount ? parseFloat(form.amount) : undefined;
    const paid = form.paymentStatus === "partial" && form.paidAmount ? parseFloat(form.paidAmount) : undefined;
    haptic("medium");
    submitWithOptimisticUpdate({
      businessId,
      customerId: form.customerId && form.customerId > 0 ? form.customerId : undefined,
      customerName: form.customerName,
      service: form.service.trim() || "General Service",
      amount: amt,
      paidAmount: paid,
      paymentStatus: form.paymentStatus,
      serviceDate: new Date().toISOString(),
      paymentDate: (form.paymentStatus === "pending" || form.paymentStatus === "partial") && form.paymentDueDate
        ? new Date(form.paymentDueDate).toISOString()
        : undefined,
      note: form.note.trim() || undefined,
    } as any);
  };

  const handleSubmitTodo = () => {
    if (!form.customerName.trim() || !form.service.trim()) return;
    haptic("medium");
    submitWithOptimisticUpdate({
      businessId,
      customerId: form.customerId && form.customerId > 0 ? form.customerId : undefined,
      customerName: form.customerName,
      service: form.service.trim(),
      amount: form.amount ? parseFloat(form.amount) : undefined,
      paymentStatus: "pending",
      serviceDate: new Date().toISOString(),
      nextVisit: form.jobDate ? new Date(form.jobDate).toISOString() : undefined,
      note: form.note.trim() || undefined,
    } as any);
  };

  // ── Income calculations ──
  const effectiveEarned = (log: ServiceLog) =>
    log.paymentStatus === "paid" ? (log.amount ?? 0) :
    log.paymentStatus === "partial" ? (log.paidAmount ?? 0) : 0;

  const effectivePending = (log: ServiceLog) =>
    log.paymentStatus === "pending" ? (log.amount ?? 0) :
    log.paymentStatus === "partial" ? (log.amount ?? 0) - (log.paidAmount ?? 0) : 0;

  const todayEarned = logs
    .filter(l => isToday(new Date(l.serviceDate)))
    .reduce((s, l) => s + effectiveEarned(l), 0);
  const monthEarned = logs
    .filter(l => isSameMonth(new Date(l.serviceDate), new Date()))
    .reduce((s, l) => s + effectiveEarned(l), 0);
  const totalPending = logs.reduce((s, l) => s + effectivePending(l), 0);

  const unpaidCount = logs.filter(l => l.paymentStatus !== "paid").length;

  const [logFilter, setLogFilter] = useState<"all" | "todo" | "done">("all");

  const filteredLogs = logFilter === "all"
    ? logs
    : logFilter === "todo"
      ? logs.filter(l => !!(l.nextVisit && l.paymentStatus === "pending"))
      : logs.filter(l => !(l.nextVisit && l.paymentStatus === "pending"));

  const filteredCustomers = customers.filter(c =>
    c.id > 0 &&
    (c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch))
  );

  if (!businessId) return <Redirect to="/app/login" />;

  return (
    <>
    <MobileLayout>
      <div className="flex flex-col min-h-screen">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-4 pt-5 pb-2">
          <h1 className="text-2xl font-display font-bold tracking-tight">Income</h1>
          <button onClick={() => { haptic("light"); openDrawer(); }}
            className="w-11 h-11 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all font-bold">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* ── FILTER CHIPS ── */}
        <div className="flex gap-2 px-4 pt-4">
          {([
            { key: "all", label: "Sab" },
            { key: "todo", label: "Kaam Karna Hai" },
            { key: "done", label: "Kaam Ho Gaya" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => { haptic("light"); setLogFilter(f.key); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border active:scale-95 ${
                logFilter === f.key
                  ? f.key === "todo"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : f.key === "done"
                      ? "bg-green-600 text-white border-green-600 shadow-sm"
                      : "bg-primary text-white border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* ── LOG LIST ── */}
        <div className="flex-1 px-4 pt-3 pb-28">
          {isLoading ? (
            <ServicesSkeleton rows={5} />

          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
                <Wallet className="w-12 h-12 text-primary/40" />
              </div>
              <h3 className="text-xl font-display font-bold text-foreground mb-2">
                Pehla kaam add karo
              </h3>
              <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed mb-6">
                Aur income track karna shuru karo — har ek rupaya count hota hai
              </p>
              <button onClick={openDrawer}
                className="px-7 py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold text-base shadow-lg shadow-primary/25 flex items-center gap-2.5 active:scale-95 transition-all hover:-translate-y-0.5">
                <Plus className="w-5 h-5" />
                Pehla Job Add Karo
              </button>
            </div>

          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mb-4">
                {logFilter === "todo" ? <Wrench className="w-10 h-10 text-muted-foreground/40" /> : <CheckCircle2 className="w-10 h-10 text-muted-foreground/40" />}
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-1">
                {logFilter === "todo" ? "Koi upcoming kaam nahi" : "Koi completed kaam nahi"}
              </h3>
              <p className="text-muted-foreground text-sm">Is filter mein kuch nahi mila</p>
            </div>

          ) : (
            <div className="space-y-3">
              {logFilter === "all" && unpaidCount > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                    {unpaidCount} payment{unpaidCount > 1 ? "s" : ""} pending
                    {totalPending > 0 && ` · ₹${totalPending.toLocaleString()} baaki`}
                  </p>
                </div>
              )}

              {filteredLogs.map(log => {
                const isPartial = log.paymentStatus === "partial";
                const isPaid = log.paymentStatus === "paid";
                const isTodo = !!(log.nextVisit && log.paymentStatus === "pending");
                const displayAmt = isPartial
                  ? `₹${(log.paidAmount ?? 0).toLocaleString()} / ₹${(log.amount ?? 0).toLocaleString()}`
                  : log.amount != null && log.amount > 0
                    ? `₹${log.amount.toLocaleString()}`
                    : null;

                return (
                  <div key={log.id} className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-base leading-tight">{log.customerName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{log.service}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            {isTodo && log.nextVisit ? (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                                <CalendarDays className="w-3 h-3" />
                                {format(new Date(log.nextVisit), "d MMM yyyy")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {format(new Date(log.serviceDate), "d MMM yyyy")}
                              </span>
                            )}
                            {log.paymentDate && !isPaid && !isTodo && (
                              <span className="flex items-center gap-1 text-orange-500 font-semibold">
                                <Bell className="w-3 h-3" />
                                Due: {format(new Date(log.paymentDate), "d MMM")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {displayAmt ? (
                            <p className={`text-xl font-display font-bold ${
                              isPaid ? "text-green-600"
                              : isPartial ? "text-purple-600 dark:text-purple-400"
                              : "text-orange-500"
                            }`}>
                              {displayAmt}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground font-medium">No amount</p>
                          )}

                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                            isPaid
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : isPartial
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                : isTodo
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                          }`}>
                            {isPaid ? <><CheckCircle2 className="w-3 h-3" /> Paid</>
                              : isPartial ? <><SplitSquareHorizontal className="w-3 h-3" /> Partial</>
                              : isTodo ? <><Wrench className="w-3 h-3" /> Upcoming</>
                              : <><Clock className="w-3 h-3" /> Pending</>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Inline error banner — shown only for the row that errored */}
                    {completionError && completionError.logId === log.id && (
                      <div className="px-4 pb-2">
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-xl px-3 py-2 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 leading-snug">
                            {completionError.message}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border/40 flex">
                      {isTodo ? (
                        <button
                          onClick={() => openWorkDone(log)}
                          disabled={completingId === log.id}
                          className="flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10">
                          {completingId === log.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><Hammer className="w-3.5 h-3.5" /> Kaam Ho Gaya!</>}
                        </button>
                      ) : (() => {
                        // Mark Complete button — separate from Mark Paid.
                        // Three visual states based on completionStatus + 10-min undo window.
                        void tick; // re-render with each timer tick
                        const completionStatus = (log as any).completionStatus as string | undefined;
                        const completedAt = (log as any).completedAt as string | null | undefined;
                        const isCompleted = completionStatus === "completed";
                        const completedMs = completedAt ? new Date(completedAt).getTime() : 0;
                        const undoMsLeft = isCompleted && completedMs
                          ? Math.max(0, 10 * 60_000 - (Date.now() - completedMs))
                          : 0;
                        const canUndo = isCompleted && undoMsLeft > 0;
                        const inFlight = markingCompleteId === log.id || undoingId === log.id;

                        let label: React.ReactNode;
                        let color: string;
                        let onClick: () => void;
                        let disabled = inFlight;

                        if (canUndo) {
                          const mins = Math.floor(undoMsLeft / 60_000);
                          const secs = Math.floor((undoMsLeft % 60_000) / 1000);
                          label = inFlight
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <>↶ Undo ({mins}:{secs.toString().padStart(2, "0")})</>;
                          color = "text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10";
                          onClick = () => undoComplete.mutate(log.id);
                        } else if (isCompleted) {
                          label = <><CheckCircle2 className="w-3.5 h-3.5" /> Completed</>;
                          color = "text-muted-foreground/60 cursor-not-allowed";
                          onClick = () => {};
                          disabled = true;
                        } else {
                          label = inFlight
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete</>;
                          color = "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10";
                          onClick = () => markComplete.mutate(log.id);
                        }

                        return (
                          <>
                            <button
                              onClick={onClick}
                              disabled={disabled}
                              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${color}`}>
                              {label}
                            </button>
                            <div className="w-px bg-border/40" />
                            <button
                              onClick={() => togglePayment.mutate({ id: log.id, currentStatus: log.paymentStatus })}
                              disabled={togglingId === log.id}
                              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                                isPaid
                                  ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10"
                                  : isPartial
                                    ? "text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/10"
                                    : "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10"
                              }`}>
                              {togglingId === log.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : isPaid ? "Mark Pending" : "Mark Paid ₹"}
                            </button>
                          </>
                        );
                      })()}
                      <div className="w-px bg-border/40" />
                      <button
                        onClick={() => { haptic("light"); setSelectedLog(log); }}
                        className="px-3 py-2.5 text-primary hover:bg-primary/5 transition-colors flex items-center gap-1 text-xs font-bold">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-px bg-border/40" />
                      <button
                        onClick={() => { if (deletingId !== log.id) deleteLog.mutate(log.id); }}
                        disabled={deletingId === log.id}
                        className="px-3 py-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
                        {deletingId === log.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── WORK DONE PAYMENT MODAL ── */}
      {workDoneLog && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setWorkDoneLog(null)} />
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
            <div className="w-full max-w-sm pointer-events-auto bg-card rounded-t-3xl shadow-2xl border border-border/40 pb-8 animate-in slide-in-from-bottom-4 duration-300">

              {/* Header */}
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-t-3xl px-5 pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Hammer className="w-5 h-5 text-white" />
                  </div>
                  <button onClick={() => setWorkDoneLog(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <h2 className="text-xl font-display font-bold text-white">Kaam Ho Gaya! 🎉</h2>
                <p className="text-white/70 text-sm mt-0.5">{workDoneLog.customerName} · {workDoneLog.service}</p>
              </div>

              <div className="px-5 pt-5 space-y-4">
                {/* Payment status */}
                <div>
                  <p className="text-sm font-bold text-foreground mb-3">Payment hua?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["paid", "partial", "pending"] as PayStatus[]).map(status => {
                      const active = workDonePayStatus === status;
                      const styles: Record<PayStatus, string> = {
                        paid: active ? "bg-green-500 text-white border-green-500 shadow-md" : "bg-background text-muted-foreground border-border hover:border-green-300",
                        partial: active ? "bg-purple-500 text-white border-purple-500 shadow-md" : "bg-background text-muted-foreground border-border hover:border-purple-300",
                        pending: active ? "bg-orange-500 text-white border-orange-500 shadow-md" : "bg-background text-muted-foreground border-border hover:border-orange-300",
                      };
                      const labels: Record<PayStatus, string> = { paid: "Pura Mila ✓", partial: "Kuch Mila", pending: "Nahi Mila" };
                      const icons: Record<PayStatus, React.ReactNode> = {
                        paid: <CheckCircle2 className="w-4 h-4" />,
                        partial: <SplitSquareHorizontal className="w-4 h-4" />,
                        pending: <Clock className="w-4 h-4" />,
                      };
                      return (
                        <button key={status} type="button"
                          onClick={() => { haptic("light"); setWorkDonePayStatus(status); }}
                          className={`py-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 border-2 transition-all ${styles[status]}`}>
                          {icons[status]}
                          {labels[status]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Partial: how much received */}
                {workDonePayStatus === "partial" && (
                  <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200/60 rounded-2xl p-4">
                    <label className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-1">
                      <SplitSquareHorizontal className="w-3.5 h-3.5" /> Abhi kitna mila?
                    </label>
                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <input
                        type="number" inputMode="numeric"
                        placeholder="e.g. 500"
                        className="flex-1 text-xl font-display font-bold bg-transparent outline-none text-purple-800 dark:text-purple-300 placeholder:text-purple-300"
                        value={workDonePaidAmount}
                        onChange={e => setWorkDonePaidAmount(e.target.value)}
                      />
                      {workDoneLog.amount && workDonePaidAmount && parseFloat(workDoneLog.amount as any) > parseFloat(workDonePaidAmount) && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold whitespace-nowrap">
                          ₹{(parseFloat(workDoneLog.amount as any) - parseFloat(workDonePaidAmount)).toLocaleString()} baaki
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Due date for pending/partial */}
                {(workDonePayStatus === "pending" || workDonePayStatus === "partial") && (
                  <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200/60 rounded-2xl p-4">
                    <label className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
                      <Bell className="w-3.5 h-3.5" /> Paise kab loge?
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 bg-background border border-orange-200 dark:border-orange-700/50 rounded-xl text-sm focus:border-orange-400 outline-none"
                      value={workDoneDueDate}
                      min={TODAY}
                      onChange={e => setWorkDoneDueDate(e.target.value)}
                    />
                    {workDoneDueDate && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1.5 flex items-center gap-1">
                        <Bell className="w-3 h-3" /> Reminder: {format(new Date(workDoneDueDate + "T00:00:00"), "d MMMM yyyy")}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={submitWorkDone}
                  disabled={completeWork.isPending}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]">
                  {completeWork.isPending
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <><CheckCircle2 className="w-5 h-5" /> Confirm</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── SERVICE DETAIL POPUP ── */}
      {selectedLog && (() => {
        const log = selectedLog;
        const isPaid = log.paymentStatus === "paid";
        const isPartial = log.paymentStatus === "partial";
        const isPending = log.paymentStatus === "pending";
        const isLogTodo = !!(log.nextVisit && log.paymentStatus === "pending");
        const pendingAmt = isPending ? (log.amount ?? 0) : isPartial ? (log.amount ?? 0) - (log.paidAmount ?? 0) : 0;
        const paidAmt = isPaid ? (log.amount ?? 0) : isPartial ? (log.paidAmount ?? 0) : 0;

        return (
          <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-sm pointer-events-auto bg-card rounded-3xl shadow-2xl border border-border/40 pb-6 overflow-hidden animate-in zoom-in-95 fade-in duration-200">

                {/* Header */}
                <div className={`px-5 pt-5 pb-4 ${
                  isPaid ? "bg-green-500" : isPartial ? "bg-purple-500" : isLogTodo ? "bg-blue-500" : "bg-orange-500"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                      isPaid ? "bg-green-600/40 text-white" : isPartial ? "bg-purple-600/40 text-white" : isLogTodo ? "bg-blue-600/40 text-white" : "bg-orange-600/40 text-white"
                    }`}>
                      {isPaid ? <><CheckCircle2 className="w-3 h-3" /> Paid</>
                        : isPartial ? <><SplitSquareHorizontal className="w-3 h-3" /> Partial Payment</>
                        : isLogTodo ? <><Wrench className="w-3 h-3" /> Upcoming</>
                        : <><Clock className="w-3 h-3" /> Pending</>}
                    </span>
                    <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <h2 className="text-2xl font-display font-bold text-white leading-tight">{log.customerName}</h2>
                  <p className="text-white/70 text-sm mt-0.5 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5" /> {log.service}
                  </p>
                </div>

                {/* Body */}
                <div className="px-5 pt-5 space-y-4">

                  {/* Service Date / Scheduled Date */}
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLogTodo ? "bg-blue-100 dark:bg-blue-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                      <CalendarDays className={`w-4 h-4 ${isLogTodo ? "text-blue-600 dark:text-blue-400" : "text-blue-600 dark:text-blue-400"}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {isLogTodo ? "Kaam kab karna hai" : "Kaam kab hua"}
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {isLogTodo && log.nextVisit
                          ? format(new Date(log.nextVisit), "EEEE, d MMMM yyyy")
                          : format(new Date(log.serviceDate), "EEEE, d MMMM yyyy")}
                      </p>
                    </div>
                  </div>

                  {/* Payment breakdown */}
                  <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Payment Detail</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-sm font-bold text-foreground">
                        {log.amount != null ? `₹${log.amount.toLocaleString()}` : "—"}
                      </p>
                    </div>
                    {(isPaid || isPartial) && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Mila (Received)</p>
                        <p className="text-sm font-bold text-green-600">₹{paidAmt.toLocaleString()}</p>
                      </div>
                    )}
                    {(isPending || isPartial) && pendingAmt > 0 && (
                      <div className="flex items-center justify-between border-t border-border/40 pt-3">
                        <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">Baaki (Pending)</p>
                        <p className="text-lg font-display font-bold text-orange-600 dark:text-orange-400">₹{pendingAmt.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Payment Due Date (if pending/partial) */}
                  {(isPending || isPartial) && log.paymentDate && (
                    <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200/50 rounded-2xl p-3">
                      <Bell className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Paise lene ka din</p>
                        <p className="text-sm font-bold text-orange-700 dark:text-orange-300">
                          {format(new Date(log.paymentDate), "EEEE, d MMMM yyyy")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Next Visit */}
                  {log.nextVisit && (
                    <div className="flex items-start gap-3 bg-secondary/10 border border-secondary/20 rounded-2xl p-3">
                      <ChevronRight className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-secondary font-semibold">Next Visit</p>
                        <p className="text-sm font-bold text-foreground">
                          {format(new Date(log.nextVisit), "EEEE, d MMMM yyyy")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {log.note && (
                    <div className="flex items-start gap-3">
                      <StickyNote className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Note</p>
                        <p className="text-sm text-foreground">{log.note}</p>
                      </div>
                    </div>
                  )}

                  {/* Added on */}
                  <p className="text-xs text-muted-foreground/60 text-center pt-1">
                    Log #{log.id} · Added {format(new Date(log.createdAt), "d MMM yyyy")}
                  </p>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Backdrop */}
      <div className={`fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={closeDrawer} />

      {/* ── CENTERED MODAL ── */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none`}>
        <div className={`w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border/50 transition-all duration-300 ease-out flex flex-col max-h-[85vh] pointer-events-auto ${drawerOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}`}>

        {/* ── STEP 1: Choose Customer ── */}
        {drawerStep === "customer" && (
          <div className="flex-1 min-h-0 flex flex-col px-4 pt-4 pb-6">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-xl font-display font-bold">Kaun aaya?</h2>
              <button onClick={closeDrawer} className="p-2 hover:bg-muted rounded-full"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Customer ka naam..."
              className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none mb-3 text-sm flex-shrink-0"
              value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                setForm(f => ({ ...f, customerName: e.target.value }));
              }}
            />
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 mb-3">
              {customersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                <button key={c.id}
                  onClick={() => {
                    haptic("light");
                    setForm(f => ({ ...f, customerId: c.id, customerName: c.name }));
                    setCustomerSearch("");
                    setDrawerStep("flowSelect");
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-muted transition-colors flex items-center gap-3 border border-border/50 bg-background">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <p className="font-semibold text-sm">{c.name}</p>
                </button>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {customerSearch ? "Koi match nahi mila" : "Abhi koi customer nahi — naam type karo"}
                </p>
              )}
            </div>
            {customerSearch.trim() && (
              <button
                onClick={() => {
                  haptic("light");
                  setForm(f => ({ ...f, customerName: customerSearch.trim(), customerId: undefined }));
                  setDrawerStep("flowSelect");
                }}
                className="w-full py-3 border-2 border-dashed border-primary/30 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 flex-shrink-0">
                <User className="w-4 h-4" /> Use "{customerSearch.trim()}"
              </button>
            )}
          </div>
        )}

        {/* ── STEP 2: Flow Select — Kiya kaam kiya ── */}
        {drawerStep === "flowSelect" && (
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setDrawerStep("customer")} className="p-2 hover:bg-muted rounded-full text-muted-foreground">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">Customer</p>
                <h2 className="text-lg font-display font-bold leading-tight">{form.customerName}</h2>
              </div>
              <button onClick={closeDrawer} className="p-2 hover:bg-muted rounded-full"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 text-center">Kiya kam kiya?</p>

            <div className="space-y-3">
              {/* Option 1: Kaam ho gaya */}
              <button
                onClick={() => {
                  haptic("medium");
                  setFlowType("done");
                  setDrawerStep("details");
                }}
                className="w-full flex items-center gap-4 px-5 py-5 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-2xl text-left hover:bg-blue-100 dark:hover:bg-blue-900/30 active:scale-[0.98] transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30 group-active:scale-90 transition-transform">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-blue-700 dark:text-blue-300">Kaam ho gaya</p>
                  <p className="text-xs text-blue-500/80 dark:text-blue-400/70 mt-0.5">Payment record karo</p>
                </div>
                <ChevronRight className="w-5 h-5 text-blue-400 ml-auto" />
              </button>

              {/* Option 2: Kaam karna hai */}
              <button
                onClick={() => {
                  haptic("medium");
                  setFlowType("todo");
                  setDrawerStep("details");
                }}
                className="w-full flex items-center gap-4 px-5 py-5 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-2xl text-left hover:bg-green-100 dark:hover:bg-green-900/30 active:scale-[0.98] transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-green-500/30 group-active:scale-90 transition-transform">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-green-700 dark:text-green-300">Kaam karna hai</p>
                  <p className="text-xs text-green-500/80 dark:text-green-400/70 mt-0.5">Upcoming job schedule karo</p>
                </div>
                <ChevronRight className="w-5 h-5 text-green-400 ml-auto" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Details — Flow 1 (Kaam ho gaya) ── */}
        {drawerStep === "details" && flowType === "done" && (
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setDrawerStep("flowSelect")} className="p-2 hover:bg-muted rounded-full text-muted-foreground">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Kaam ho gaya</p>
                </div>
                <h2 className="text-lg font-display font-bold leading-tight">{form.customerName}</h2>
              </div>
              <button onClick={closeDrawer} className="p-2 hover:bg-muted rounded-full"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <div className="space-y-4">

              {/* Service name — what work was done */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Kiya kaam kiya? <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Haircut, AC repair, Colour..."
                  className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl text-sm font-medium focus:border-primary outline-none transition-colors"
                  value={form.service}
                  onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                />
              </div>

              {/* Amount */}
              <div className="bg-background rounded-2xl border-2 border-border focus-within:border-primary transition-colors">
                <div className="flex items-center px-4 py-3">
                  <IndianRupee className="w-6 h-6 text-primary mr-2 flex-shrink-0" />
                  <input
                    ref={amountInputRef}
                    type="number" inputMode="numeric"
                    placeholder="0"
                    className="flex-1 text-3xl font-display font-bold bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30 w-full"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <p className="px-4 pb-2 text-xs text-muted-foreground">Amount (optional)</p>
              </div>

              {/* Payment Status */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <IndianRupee className="w-3 h-3" /> Payment status
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["paid", "pending", "partial"] as PayStatus[]).map(status => {
                    const active = form.paymentStatus === status;
                    const styles: Record<PayStatus, string> = {
                      paid: active ? "bg-green-500 text-white border-green-500 shadow-md" : "bg-background text-muted-foreground border-border hover:border-green-300",
                      pending: active ? "bg-orange-500 text-white border-orange-500 shadow-md" : "bg-background text-muted-foreground border-border hover:border-orange-300",
                      partial: active ? "bg-purple-500 text-white border-purple-500 shadow-md" : "bg-background text-muted-foreground border-border hover:border-purple-300",
                    };
                    const icons: Record<PayStatus, React.ReactNode> = {
                      paid: <CheckCircle2 className="w-3.5 h-3.5" />,
                      pending: <Clock className="w-3.5 h-3.5" />,
                      partial: <SplitSquareHorizontal className="w-3.5 h-3.5" />,
                    };
                    const labels: Record<PayStatus, string> = { paid: "Paid", pending: "Pending", partial: "Partial" };
                    return (
                      <button key={status} type="button"
                        onClick={() => { haptic("light"); setForm(f => ({ ...f, paymentStatus: status })); }}
                        className={`py-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border-2 transition-all ${styles[status]}`}>
                        {icons[status]}
                        {labels[status]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Partial: how much received */}
              {form.paymentStatus === "partial" && (
                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200/60 rounded-2xl p-4">
                  <label className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-1">
                    <SplitSquareHorizontal className="w-3.5 h-3.5" /> Abhi kitna mila?
                  </label>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <input
                      type="number" inputMode="numeric"
                      placeholder="e.g. 500"
                      className="flex-1 text-xl font-display font-bold bg-transparent outline-none text-purple-800 dark:text-purple-300 placeholder:text-purple-300"
                      value={form.paidAmount}
                      onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))}
                    />
                    {form.amount && form.paidAmount && parseFloat(form.amount) > parseFloat(form.paidAmount) && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold whitespace-nowrap">
                        ₹{(parseFloat(form.amount) - parseFloat(form.paidAmount)).toLocaleString()} baaki
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Payment due date — only for pending/partial */}
              {(form.paymentStatus === "pending" || form.paymentStatus === "partial") && (
                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200/60 rounded-2xl p-4">
                  <label className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5" /> Paise kab lene hai?
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 bg-background border border-orange-200 dark:border-orange-700/50 rounded-xl text-sm focus:border-orange-400 outline-none"
                    value={form.paymentDueDate}
                    min={TODAY}
                    onChange={e => setForm(f => ({ ...f, paymentDueDate: e.target.value }))}
                  />
                  {form.paymentDueDate && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1.5 flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Reminder set: {format(new Date(form.paymentDueDate + "T00:00:00"), "d MMMM yyyy")}
                    </p>
                  )}
                </div>
              )}

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <StickyNote className="w-3 h-3" /> Note (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Kuch khas notes..."
                  className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl text-sm focus:border-primary outline-none resize-none"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>

            <button onClick={handleSubmitDone} disabled={createLog.isPending || !form.customerName.trim()}
              className="mt-5 w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]">
              {createLog.isPending
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <>
                    <CheckCircle2 className="w-5 h-5" />
                    Save Karo
                    {(form.paymentStatus === "pending" || form.paymentStatus === "partial") && form.paymentDueDate && (
                      <span className="text-xs font-normal opacity-80 ml-1">· Reminder set</span>
                    )}
                  </>
              }
            </button>
          </div>
        )}

        {/* ── STEP 3: Details — Flow 2 (Kaam karna hai) ── */}
        {drawerStep === "details" && flowType === "todo" && (
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setDrawerStep("flowSelect")} className="p-2 hover:bg-muted rounded-full text-muted-foreground">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 font-semibold">Kaam karna hai</p>
                </div>
                <h2 className="text-lg font-display font-bold leading-tight">{form.customerName}</h2>
              </div>
              <button onClick={closeDrawer} className="p-2 hover:bg-muted rounded-full"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <div className="space-y-4">

              {/* What work */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Kaam kya hai?
                </label>
                <input
                  ref={jobInputRef}
                  type="text"
                  placeholder="e.g. AC Repair, Plumbing fix..."
                  className="w-full px-4 py-3.5 bg-background border-2 border-border rounded-xl text-sm focus:border-green-400 focus:ring-2 focus:ring-green-400/10 outline-none font-medium"
                  value={form.service}
                  onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                />
              </div>

              {/* When */}
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200/60 rounded-2xl p-4">
                <label className="text-xs font-bold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Kab karna hai?
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-background border border-green-200 dark:border-green-700/50 rounded-xl text-sm focus:border-green-400 outline-none"
                  value={form.jobDate}
                  min={TODAY}
                  onChange={e => setForm(f => ({ ...f, jobDate: e.target.value }))}
                />
                {form.jobDate && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1.5 flex items-center gap-1">
                    <Bell className="w-3 h-3" /> Reminder set: {format(new Date(form.jobDate + "T00:00:00"), "d MMMM yyyy")}
                  </p>
                )}
              </div>

              {/* Expected Amount */}
              <div className="bg-background rounded-2xl border-2 border-border focus-within:border-green-400 transition-colors">
                <div className="flex items-center px-4 py-3">
                  <IndianRupee className="w-6 h-6 text-green-500 mr-2 flex-shrink-0" />
                  <input
                    type="number" inputMode="numeric"
                    placeholder="0"
                    className="flex-1 text-3xl font-display font-bold bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30 w-full"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <p className="px-4 pb-2 text-xs text-muted-foreground">Expected amount (optional)</p>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <StickyNote className="w-3 h-3" /> Note (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Kuch khas notes..."
                  className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl text-sm focus:border-primary outline-none resize-none"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>

            <button
              onClick={handleSubmitTodo}
              disabled={createLog.isPending || !form.customerName.trim() || !form.service.trim()}
              className="mt-5 w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]">
              {createLog.isPending
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <>
                    <Bell className="w-5 h-5" />
                    Schedule Karo
                    {form.jobDate && <span className="text-xs font-normal opacity-80 ml-1">· Reminder set</span>}
                  </>
              }
            </button>
          </div>
        )}
        </div>
      </div>
    </MobileLayout>
    </>
  );
}
