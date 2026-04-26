import * as React from "react";
import {
  format,
  parse,
  isValid,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
} from "date-fns";
import {
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunrise,
  CalendarRange,
  CalendarClock,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  fromYear?: number;
  toYear?: number;
  disablePast?: boolean;
  disableFuture?: boolean;
  allowClear?: boolean;
};

function toDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const onlyDate = v.includes("T") ? v.split("T")[0] : v;
  const d = parse(onlyDate, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function toIso(d?: Date): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DatePicker({
  value,
  onChange,
  placeholder = "Choose date",
  className,
  fromYear = 1940,
  toYear = new Date().getFullYear() + 5,
  disablePast,
  disableFuture,
  allowClear = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);
  const today = React.useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [viewMonth, setViewMonth] = React.useState<Date>(selected || today);
  const [pickerMode, setPickerMode] = React.useState<"day" | "month" | "year">("day");

  React.useEffect(() => {
    if (open) {
      setViewMonth(selected || today);
      setPickerMode("day");
    }
  }, [open]);

  const baseInp =
    "w-full px-4 py-3.5 bg-card border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-base";

  const setQuick = (d: Date) => {
    onChange(toIso(d));
    setOpen(false);
  };

  const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  const isDayDisabled = (d: Date): boolean => {
    if (disablePast && isBefore(d, today)) return true;
    if (disableFuture && isAfter(d, today)) return true;
    return false;
  };

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const goPrev = () => setViewMonth((m) => subMonths(m, 1));
  const goNext = () => setViewMonth((m) => addMonths(m, 1));

  const years: number[] = [];
  for (let y = toYear; y >= fromYear; y--) years.push(y);

  const QUICK_ACTIONS: { label: string; icon: React.ReactNode; date: Date }[] = [
    { label: "Today",     icon: <Sun className="w-3.5 h-3.5" />,           date: today },
    { label: "Tomorrow",  icon: <Sunrise className="w-3.5 h-3.5" />,       date: addDays(1) },
    { label: "+1 week",   icon: <CalendarRange className="w-3.5 h-3.5" />, date: addDays(7) },
    { label: "+1 month",  icon: <CalendarClock className="w-3.5 h-3.5" />, date: addDays(30) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            baseInp,
            "flex items-center justify-between gap-2 text-left",
            !selected && "text-muted-foreground/60",
            className,
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <CalendarDays className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">
              {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
            </span>
          </span>
          {allowClear && selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              className="p-1 -mr-1 rounded-md hover:bg-muted shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[336px] p-0 rounded-3xl border-2 shadow-2xl overflow-hidden"
        align="start"
        sideOffset={6}
      >
        {/* Quick action pills */}
        <div className="p-3 bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent border-b grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((q) => {
            const isActive = selected && isSameDay(selected, q.date);
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => setQuick(q.date)}
                className={cn(
                  "flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold transition-all border-2 active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
                    : "bg-background border-border/60 hover:border-primary/40 hover:bg-primary/5 text-foreground",
                )}
              >
                {q.icon}
                <span>{q.label}</span>
              </button>
            );
          })}
        </div>

        {/* Header: month/year nav */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPickerMode((m) => (m === "month" ? "day" : "month"))}
              className={cn(
                "px-3 h-9 rounded-xl text-sm font-bold transition-all hover:bg-muted active:scale-95",
                pickerMode === "month" && "bg-primary/10 text-primary",
              )}
            >
              {format(viewMonth, "MMMM")}
            </button>
            <button
              type="button"
              onClick={() => setPickerMode((m) => (m === "year" ? "day" : "year"))}
              className={cn(
                "px-3 h-9 rounded-xl text-sm font-bold transition-all hover:bg-muted active:scale-95",
                pickerMode === "year" && "bg-primary/10 text-primary",
              )}
            >
              {viewMonth.getFullYear()}
            </button>
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {pickerMode === "day" && (
          <div className="px-3 pb-4">
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={i}
                  className="h-8 flex items-center justify-center text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0.5">
                  {week.map((day) => {
                    const isOutside = !isSameMonth(day, viewMonth);
                    const isSelectedDay = !!(selected && isSameDay(day, selected));
                    const isToday = isSameDay(day, today);
                    const isDisabled = isDayDisabled(day);

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          onChange(toIso(day));
                          setOpen(false);
                        }}
                        className={cn(
                          "h-10 w-10 mx-auto rounded-xl flex items-center justify-center text-sm font-semibold transition-all relative",
                          !isDisabled && "hover:bg-primary/10 active:scale-90",
                          isOutside && !isSelectedDay && "text-muted-foreground/30",
                          !isOutside && !isSelectedDay && !isToday && "text-foreground",
                          isToday && !isSelectedDay && "text-primary ring-2 ring-primary/40 ring-inset",
                          isSelectedDay && "bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/40 ring-0 scale-105 hover:opacity-95",
                          isDisabled && "opacity-30 cursor-not-allowed",
                        )}
                      >
                        {day.getDate()}
                        {isToday && !isSelectedDay && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {pickerMode === "month" && (
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            {MONTHS_SHORT.map((m, idx) => {
              const isActive = viewMonth.getMonth() === idx;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setViewMonth(new Date(viewMonth.getFullYear(), idx, 1));
                    setPickerMode("day");
                  }}
                  className={cn(
                    "h-11 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
                      : "bg-background border-border/60 hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        )}

        {pickerMode === "year" && (
          <div className="grid grid-cols-4 gap-2 px-4 pb-4 max-h-[260px] overflow-y-auto">
            {years.map((y) => {
              const isActive = viewMonth.getFullYear() === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewMonth(new Date(y, viewMonth.getMonth(), 1));
                    setPickerMode("day");
                  }}
                  className={cn(
                    "h-10 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
                      : "bg-background border-border/60 hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
